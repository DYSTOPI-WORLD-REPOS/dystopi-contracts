const { ethers } = require('hardhat');
const {
  PAUSER_ROLE,
  DEFAULT_ADMIN_ROLE,
  TREASURER_ROLE,
  FEE_ADMIN_ROLE,
  MAX_SOLIDITY_INTEGER
} = require('../utils/constants');
const { expect } = require('chai');

describe('DYSToken', () => {
  let DysTokenFactory;
  let MockUniswapV2RouterFactory;
  let MockERC20Factory;
  let dysToken;
  let uniswapV2Router;
  let weth;
  let dysTokenAdmin;
  let dysTokenPauser;
  let dysTokenTreasurer;
  let dysTokenFeeAdmin;
  let dysTokenUser;
  let dysTokenDex;
  let deployer;
  let admin;
  let user;
  let pauser;
  let treasurer;
  let feeAdmin;
  let dex;

  before(async () => {
    DysTokenFactory = await ethers.getContractFactory('DYSToken');
    MockUniswapV2RouterFactory = await ethers.getContractFactory(
      'MockUniswapV2Router'
    );
    MockERC20Factory = await ethers.getContractFactory('MockERC20');
  });

  beforeEach(async () => {
    let beneficiary;
    [deployer, admin, user, pauser, treasurer, feeAdmin, dex, beneficiary] =
      await ethers.getSigners();

    weth = await MockERC20Factory.deploy(
      'Wrapped Ether',
      'WETH',
      user.address,
      1_000_000
    );
    await weth.deployed();

    uniswapV2Router = await MockUniswapV2RouterFactory.deploy(weth.address);
    await uniswapV2Router.deployed();

    dysToken = await DysTokenFactory.deploy(
      admin.address,
      pauser.address,
      feeAdmin.address,
      treasurer.address,
      uniswapV2Router.address,
      beneficiary.address,
      1_000_000
    );
    await dysToken.deployed();

    dysTokenAdmin = dysToken.connect(admin);
    dysTokenPauser = dysToken.connect(pauser);
    dysTokenTreasurer = dysToken.connect(treasurer);
    dysTokenFeeAdmin = dysToken.connect(feeAdmin);
    dysTokenUser = dysToken.connect(user);
    dysTokenDex = dysToken.connect(dex);

    await dysToken
      .connect(beneficiary)
      .transfer(dex.address, ethers.utils.parseEther('500000'));
    await dysToken
      .connect(beneficiary)
      .transfer(user.address, ethers.utils.parseEther('500000'));
    await dysTokenAdmin.setIsDex(dex.address, true);
    // buy fees set to 5%
    await dysTokenFeeAdmin.setBuyFeePercentage(500);
    // sell fees set to 10%
    await dysTokenFeeAdmin.setSellFeePercentage(1000);
  });

  describe('constructor', () => {
    it('should have deployed with all roles and addresses set', async () => {
      expect(await dysToken.hasRole(PAUSER_ROLE, pauser.address)).to.equal(
        true
      );
      expect(
        await dysToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)
      ).to.equal(true);
      expect(
        await dysToken.hasRole(TREASURER_ROLE, treasurer.address)
      ).to.equal(true);
      expect(await dysToken.hasRole(FEE_ADMIN_ROLE, feeAdmin.address)).to.equal(
        true
      );
      expect(await dysToken.v2Router()).to.equal(uniswapV2Router.address);
      expect(await dysToken.totalSupply()).to.equal(
        ethers.utils.parseEther('1000000')
      );
      expect(
        await dysToken.allowance(dysToken.address, uniswapV2Router.address)
      ).to.equal(MAX_SOLIDITY_INTEGER);
    });
  });

  describe('transfer', () => {
    it('should transfer tokens and apply buy fee if set', async () => {
      const promise = dysTokenDex.transfer(user.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, user.address, '95');

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, dysToken.address, '5');

      await expect(promise)
        .to.emit(uniswapV2Router, 'SwapExactTokensForETH')
        .withArgs(
          5,
          0,
          [dysToken.address, weth.address],
          dysToken.address,
          block.timestamp
        );
    });

    it('should transfer tokens and apply sell fee if set', async () => {
      const promise = dysTokenUser.transfer(dex.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dex.address, '90');

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dysToken.address, '10');

      await expect(promise)
        .to.emit(uniswapV2Router, 'SwapExactTokensForETH')
        .withArgs(
          10,
          0,
          [dysToken.address, weth.address],
          dysToken.address,
          block.timestamp
        );
    });
    it('should transfer tokens and apply buy and sell fee but not swap if swapFeesToEth === false', async () => {
      await dysTokenFeeAdmin.setSwapFeesToEth(false);
      const sellPromise = dysTokenUser.transfer(dex.address, 100);
      const buyPromise = dysTokenDex.transfer(user.address, 100);

      await expect(sellPromise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dex.address, '90');
      await expect(buyPromise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, user.address, '95');

      await expect(sellPromise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dysToken.address, '10');
      await expect(buyPromise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, dysToken.address, '5');

      await expect(sellPromise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
      await expect(buyPromise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
    });
    it('it should transfer tokens and not apply fee if recipient is whitelisted', async () => {
      await dysTokenAdmin.setWhitelistedAddress(user.address, true);
      const promise = dysTokenDex.transfer(user.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, user.address, '100');

      await expect(promise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
    });
    it('should transfer tokens and not apply fee if sender is whitelisted', async () => {
      await dysTokenAdmin.setWhitelistedAddress(user.address, true);
      const promise = dysTokenUser.transfer(dex.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dex.address, '100');

      await expect(promise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
    });
    it('should transfer tokens and not apply fee if neither the to nor the from is dex', async () => {
      const promise = dysTokenUser.transfer(admin.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, admin.address, '100');

      await expect(promise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
    });
    it('should transfer tokens and not apply fee if buy or sell fee is 0', async () => {
      await dysTokenFeeAdmin.setBuyFeePercentage(0);

      const promise = dysTokenDex.transfer(user.address, 100);

      await expect(promise)
        .to.emit(dysToken, 'Transfer')
        .withArgs(dex.address, user.address, '100');

      await expect(promise).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );

      await dysTokenFeeAdmin.setSellFeePercentage(0);

      const promise2 = dysTokenUser.transfer(dex.address, 100);

      await expect(promise2)
        .to.emit(dysToken, 'Transfer')
        .withArgs(user.address, dex.address, '100');

      await expect(promise2).not.to.emit(
        uniswapV2Router,
        'SwapExactTokensForETH'
      );
    });
  });

  describe('setIsDex', () => {
    it('should set isDex for a given address if called by admin', async () => {
      await dysTokenAdmin.setIsDex(user.address, true);
      expect(await dysToken.isDex(user.address)).to.equal(true);

      await expect(
        dysTokenUser.setIsDex(user.address, false)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setWhitelistedAddress', () => {
    it('should set whitelistedAddress for a given address if called by admin', async () => {
      await dysTokenAdmin.setWhitelistedAddress(user.address, true);
      expect(await dysToken.whitelist(user.address)).to.equal(true);

      await expect(
        dysTokenUser.setWhitelistedAddress(user.address, false)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setBuyFeePercentage', () => {
    it('should set buyFeePercentage if called by feeAdmin', async () => {
      await dysTokenFeeAdmin.setBuyFeePercentage(100);
      expect(await dysToken.buyFeePercentage()).to.equal(100);

      await expect(dysTokenUser.setBuyFeePercentage(200)).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${FEE_ADMIN_ROLE}`
      );
    });
  });

  describe('setSellFeePercentage', () => {
    it('should set sellFeePercentage if called by feeAdmin', async () => {
      await dysTokenFeeAdmin.setSellFeePercentage(100);
      expect(await dysToken.sellFeePercentage()).to.equal(100);

      await expect(dysTokenUser.setSellFeePercentage(200)).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${FEE_ADMIN_ROLE}`
      );
    });
  });

  describe('setTrustedForwarder', () => {
    it('should set trustedForwarder if called by admin', async () => {
      await dysTokenAdmin.setTrustedForwarder(user.address);
      expect(await dysToken.getTrustedForwarder()).to.equal(user.address);

      await expect(
        dysTokenUser.setTrustedForwarder(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setApprovalFor', () => {
    it('should set approval for a given address if called by admin', async () => {
      await dysTokenAdmin.setApprovalFor(user.address, 100);
      expect(await dysToken.allowance(dysToken.address, user.address)).to.equal(
        100
      );

      await expect(
        dysTokenUser.setApprovalFor(user.address, 100)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('pause', () => {
    it('should pause the contract if called by pauser', async () => {
      await dysTokenPauser.pause();
      expect(await dysToken.paused()).to.equal(true);

      await expect(dysTokenUser.transfer(dex.address, 100)).to.be.revertedWith(
        'Pausable: paused'
      );

      await dysTokenPauser.unpause();

      await dysTokenUser.transfer(dex.address, 100);

      await expect(dysTokenUser.pause()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });

  describe('withdraw', () => {
    it('should withdraw all eth from the contract if called by treasurer', async () => {
      await user.sendTransaction({
        to: dysToken.address,
        value: ethers.utils.parseEther('10')
      });

      const func = () => dysTokenTreasurer.withdrawETH(treasurer.address);

      await expect(func).changeEtherBalances(
        [dysToken, treasurer],
        [ethers.utils.parseEther('-10'), ethers.utils.parseEther('10')]
      );

      await expect(dysTokenUser.withdrawETH(user.address)).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${TREASURER_ROLE}`
      );
    });

    it('should withdraw all tokens from the contract if called by treasurer', async () => {
      await weth
        .connect(user)
        .transfer(dysToken.address, ethers.utils.parseEther('10'));

      const func = () =>
        dysTokenTreasurer.withdrawTokens(weth.address, treasurer.address);

      await expect(func).changeTokenBalances(
        weth,
        [dysToken, treasurer],
        [ethers.utils.parseEther('-10'), ethers.utils.parseEther('10')]
      );

      await expect(
        dysTokenUser.withdrawTokens(weth.address, user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${TREASURER_ROLE}`
      );
    });

    it('should fail to withdraw to zero address', async () => {
      await weth
        .connect(user)
        .transfer(dysToken.address, ethers.utils.parseEther('10'));

      await user.sendTransaction({
        to: dysToken.address,
        value: ethers.utils.parseEther('10')
      });

      await expect(
        dysTokenTreasurer.withdrawTokens(
          weth.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith('DYSToken: Cannot withdraw tokens to zero address');

      await expect(
        dysTokenTreasurer.withdrawETH(ethers.constants.AddressZero)
      ).to.be.revertedWith('DYSToken: Cannot withdraw ETH to zero address');
    });
  });
});
