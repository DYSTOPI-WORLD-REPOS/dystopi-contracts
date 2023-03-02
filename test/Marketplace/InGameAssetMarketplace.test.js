const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  NULL_ADDRESS,
  mockSigner,
  mockPrivateKey,
  mockPrivateKey2
} = require('../utils/constants');
const { keccak256, toUtf8Bytes } = ethers.utils;
const Web3 = require('web3');
const web3 = new Web3();

const addAssetsToMarketplace = async (
  inGameAssetMarketplace,
  erc20_1,
  erc20_2
) => {
  const asset1 = {
    assetId: 1,
    ethPrice: 0,
    erc20Address: erc20_1.address,
    erc20Price: web3.utils.toWei('100', 'ether'),
    active: true
  };
  const asset2 = {
    assetId: 3,
    ethPrice: 0,
    erc20Address: erc20_2.address,
    erc20Price: web3.utils.toWei('50', 'ether'),
    active: true
  };
  const asset3 = {
    assetId: 2,
    ethPrice: web3.utils.toWei('0.5', 'ether'),
    erc20Address: NULL_ADDRESS,
    erc20Price: 0,
    active: true
  };

  const assets = [asset1, asset2, asset3];

  const promise = inGameAssetMarketplace.setupAssets(assets);

  await promise;

  return [assets, promise];
};

const createPurchaseParams = (
  sender,
  assetIds,
  qtys,
  privateKey = mockPrivateKey
) => {
  const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  const receiptIds = assetIds.map(() => Math.floor(Math.random() * 100000 + 1));

  const hash = web3.utils.soliditySha3Raw(
    { type: 'address', value: sender },
    { type: 'uint256[]', value: assetIds },
    { type: 'uint256[]', value: qtys },
    { type: 'uint256[]', value: receiptIds },
    { type: 'bytes32', value: nonce }
  );
  const { signature, messageHash } = web3.eth.accounts.sign(hash, privateKey);
  return [assetIds, qtys, receiptIds, nonce, messageHash, signature];
};

describe('InGameAssetMarketplace', () => {
  let InGameAssetMarketplaceFactory;
  let MockERC20;
  let inGameAssetMarketplace;
  let erc20_1;
  let erc20_2;
  let inGameAssetMarketplaceAdmin;
  let inGameAssetMarketplacePauser;
  let inGameAssetMarketplaceBeneficiary;
  let inGameAssetMarketplaceStoreAdmin;
  let inGameAssetMarketplaceUser;
  let assets;
  let addAssetsPromise;
  let deployer;
  let admin;
  let pauser;
  let beneficiary;
  let storeAdmin;
  let user;

  const DEFAULT_ADMIN_ROLE = NULL_ADDRESS;
  const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE')).toLowerCase();
  const STORE_ADMIN_ROLE = keccak256(
    toUtf8Bytes('STORE_ADMIN_ROLE')
  ).toLowerCase();
  const BENEFICIARY_ROLE = keccak256(
    toUtf8Bytes('BENEFICIARY_ROLE')
  ).toLowerCase();

  before(async () => {
    InGameAssetMarketplaceFactory = await ethers.getContractFactory(
      'InGameAssetMarketplace'
    );
    MockERC20 = await ethers.getContractFactory('MockERC20');
  });

  beforeEach(async () => {
    [deployer, admin, pauser, beneficiary, storeAdmin, user] =
      await ethers.getSigners();

    inGameAssetMarketplace = await InGameAssetMarketplaceFactory.deploy(
      admin.address,
      pauser.address,
      storeAdmin.address,
      beneficiary.address,
      mockSigner,
      NULL_ADDRESS
    );
    await inGameAssetMarketplace.deployed();
    inGameAssetMarketplaceAdmin = await inGameAssetMarketplace.connect(admin);
    inGameAssetMarketplacePauser = await inGameAssetMarketplace.connect(pauser);
    inGameAssetMarketplaceBeneficiary = await inGameAssetMarketplace.connect(
      beneficiary
    );
    inGameAssetMarketplaceStoreAdmin = await inGameAssetMarketplace.connect(
      storeAdmin
    );
    inGameAssetMarketplaceUser = await inGameAssetMarketplace.connect(user);

    erc20_1 = await MockERC20.deploy(
      'ERC20 Token 1',
      'ERC201',
      user.address,
      web3.utils.toWei('1000000', 'ether')
    );
    await erc20_1.deployed();

    erc20_2 = await MockERC20.deploy(
      'ERC20 Token 2',
      'ERC202',
      user.address,
      web3.utils.toWei('1000000', 'ether')
    );
    await erc20_2.deployed();

    // approve erc20_1 for user to spend all
    await erc20_1
      .connect(user)
      .approve(inGameAssetMarketplace.address, ethers.constants.MaxUint256);

    // approve erc20_2 for user to spend all
    await erc20_2
      .connect(user)
      .approve(inGameAssetMarketplace.address, ethers.constants.MaxUint256);

    [assets, addAssetsPromise] = await addAssetsToMarketplace(
      inGameAssetMarketplaceStoreAdmin,
      erc20_1,
      erc20_2
    );
  });

  describe('purchase', () => {
    it('should purchase one with only ETH', async () => {
      const params = createPurchaseParams(
        user.address,
        [assets[2].assetId],
        [1]
      );

      const promise = inGameAssetMarketplaceUser.purchase(...params, {
        value: ethers.BigNumber.from(assets[2].ethPrice)
      });

      await expect(() => promise).changeEtherBalances(
        [user, inGameAssetMarketplace],
        [
          ethers.BigNumber.from(assets[2].ethPrice).mul(-1),
          ethers.BigNumber.from(assets[2].ethPrice)
        ]
      );

      await expect(promise)
        .to.emit(inGameAssetMarketplace, 'AssetPurchased')
        .withArgs(user.address, assets[2].assetId, 1, params[2][0]);
    });

    it('should purchase one with only ERC20', async () => {
      const params = createPurchaseParams(
        user.address,
        [assets[0].assetId],
        [1]
      );

      const promise = inGameAssetMarketplaceUser.purchase(...params);

      await expect(() => promise).changeTokenBalances(
        erc20_1,
        [user, inGameAssetMarketplace],
        [
          ethers.BigNumber.from(assets[0].erc20Price).mul(-1),
          ethers.BigNumber.from(assets[0].erc20Price)
        ]
      );

      await expect(promise)
        .to.emit(inGameAssetMarketplace, 'AssetPurchased')
        .withArgs(user.address, assets[0].assetId, 1, params[2][0]);
    });

    it('should purchase several with both ETH and ERC20', async () => {
      const boughtForEth = 2;
      const ethSpent = ethers.BigNumber.from(assets[2].ethPrice).mul(
        boughtForEth
      );
      const boughtForErc20_1 = 3;
      const boughtForErc20_2 = 4;
      const spent1 = ethers.BigNumber.from(assets[0].erc20Price).mul(
        boughtForErc20_1
      );

      const spent2 = ethers.BigNumber.from(assets[1].erc20Price).mul(
        boughtForErc20_2
      );

      const createParams = () =>
        createPurchaseParams(
          user.address,
          [assets[0].assetId, assets[1].assetId, assets[2].assetId],
          [boughtForErc20_1, boughtForErc20_2, boughtForEth]
        );

      const func = (_params) => {
        if (!_params) {
          _params = createParams();
        }
        return inGameAssetMarketplaceUser.purchase(..._params, {
          value: ethSpent
        });
      };

      await expect(func).changeEtherBalances(
        [user, inGameAssetMarketplace],
        [ethSpent.mul(-1), ethSpent]
      );

      await expect(func).changeTokenBalances(
        erc20_1,
        [user, inGameAssetMarketplace],
        [spent1.mul(-1), spent1]
      );

      await expect(func).changeTokenBalances(
        erc20_2,
        [user, inGameAssetMarketplace],
        [spent2.mul(-1), spent2]
      );

      const params = createParams();
      const promise = func(params);

      await expect(promise)
        .to.emit(inGameAssetMarketplace, 'AssetPurchased')
        .withArgs(
          user.address,
          assets[0].assetId,
          boughtForErc20_1,
          params[2][0]
        );

      await expect(promise)
        .to.emit(inGameAssetMarketplace, 'AssetPurchased')
        .withArgs(
          user.address,
          assets[1].assetId,
          boughtForErc20_2,
          params[2][1]
        );

      await expect(promise)
        .to.emit(inGameAssetMarketplace, 'AssetPurchased')
        .withArgs(user.address, assets[2].assetId, boughtForEth, params[2][2]);
    });

    it('should revert if the user does not have enough ETH', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [assets[2].assetId], [1]),
          {
            value: ethers.BigNumber.from(assets[2].ethPrice).sub(1)
          }
        )
      ).to.be.revertedWith('InGameAssetMarketplace: ETH price mismatch');
    });

    it('should revert if the user does not have enough ERC20', async () => {
      assets[0].erc20Price = web3.utils.toWei(
        '100000000000000000000000000000',
        'ether'
      );
      await inGameAssetMarketplaceStoreAdmin.setupAssets(assets);

      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [assets[0].assetId], [1])
        )
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('should revert if trying to purchase 0 assets', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [assets[0].assetId], [0])
        )
      ).to.be.revertedWith('InGameAssetMarketplace: Cannot purchase 0 assets');
    });

    it('should revert if array length mismatch', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [assets[0].assetId], [1, 1])
        )
      ).to.be.revertedWith('InGameAssetMarketplace: Array length mismatch');
    });

    it('should revert if message was not signed by signer', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [assets[0].assetId],
            [1],
            mockPrivateKey2
          )
        )
      ).to.be.revertedWith(
        'InGameAssetMarketplace: Message was not signed by signer'
      );
    });

    it('should revert if nonce was already used', async () => {
      const params = createPurchaseParams(
        user.address,
        [assets[0].assetId],
        [1]
      );

      await inGameAssetMarketplaceUser.purchase(...params);

      await expect(
        inGameAssetMarketplaceUser.purchase(...params)
      ).to.be.revertedWith('InGameAssetMarketplace: Nonce was already used');
    });

    it('should revert if hash mismatch', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(NULL_ADDRESS, [assets[0].assetId], [1])
        )
      ).to.be.revertedWith('InGameAssetMarketplace: Hash mismatch');
    });

    it('should revert if paused', async () => {
      await inGameAssetMarketplacePauser.pause();

      const params = createPurchaseParams(
        user.address,
        [assets[0].assetId],
        [1]
      );

      await expect(
        inGameAssetMarketplaceUser.purchase(...params)
      ).to.be.revertedWith('Pausable: paused');

      await inGameAssetMarketplacePauser.unpause();

      await expect(inGameAssetMarketplaceUser.purchase(...params)).to.not.be
        .reverted;
    });

    it('should revert if asset is inactive', async () => {
      await inGameAssetMarketplaceStoreAdmin.activateAssets(false, [
        assets[0].assetId
      ]);

      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [assets[0].assetId], [1])
        )
      ).to.be.revertedWith('InGameAssetMarketplace: Asset is not active');
    });

    it('should revert if 0 assetIds', async () => {
      await expect(
        inGameAssetMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [], [])
        )
      ).to.be.revertedWith('InGameAssetMarketplace: No assets to purchase');
    });
  });

  describe('setupAssets', () => {
    it('should add assets to the marketplace', async () => {
      for (const asset of assets) {
        const assetFromContract = await inGameAssetMarketplace.assetMap(
          asset.assetId
        );
        expect(assetFromContract).to.deep.equal([
          ethers.BigNumber.from(asset.assetId),
          ethers.BigNumber.from(asset.ethPrice),
          ethers.BigNumber.from(asset.erc20Price),
          asset.erc20Address,
          asset.active
        ]);

        await expect(addAssetsPromise)
          .to.emit(inGameAssetMarketplace, 'AssetActivation')
          .withArgs(asset.assetId, asset.active);
      }
    });

    it('should revert if trying to add series with invalid price config', async () => {
      assets[0].erc20Price = 0;
      assets[0].ethPrice = 0;
      await expect(
        inGameAssetMarketplaceStoreAdmin.setupAssets(assets)
      ).to.be.revertedWith(
        'InGameAssetMarketplace: Price must be defined in either an ERC20 or ETH'
      );
    });

    it('should revert if not store admin', async () => {
      await expect(
        inGameAssetMarketplaceUser.setupAssets([])
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${STORE_ADMIN_ROLE}`
      );
    });
  });

  describe('activateAssets', () => {
    it('should deactivate a list of assets than activate them again', async () => {
      const promise = inGameAssetMarketplaceStoreAdmin.activateAssets(
        false,
        assets.map((s) => s.assetId)
      );

      for await (const asset of assets) {
        await expect(promise)
          .to.emit(inGameAssetMarketplace, 'AssetActivation')
          .withArgs(asset.assetId, false);
      }

      await promise;

      for await (const asset of assets) {
        const assetFromContract = await inGameAssetMarketplace.assetMap(
          asset.assetId
        );
        expect(assetFromContract[4]).to.be.false;
      }

      const promise2 = inGameAssetMarketplaceStoreAdmin.activateAssets(
        true,
        assets.map((s) => s.assetId)
      );

      for await (const asset of assets) {
        await expect(promise2)
          .to.emit(inGameAssetMarketplace, 'AssetActivation')
          .withArgs(asset.assetId, true);
      }

      await promise2;

      for await (const asset of assets) {
        const assetFromContract = await inGameAssetMarketplace.assetMap(
          asset.assetId
        );
        expect(assetFromContract[4]).to.be.true;
      }
    });

    it('should revert if not store admin', async () => {
      await expect(
        inGameAssetMarketplaceUser.activateAssets(true, [1])
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${STORE_ADMIN_ROLE}`
      );
    });
  });

  describe('withdrawEth', () => {
    it('should withdraw ETH from the contract for beneficiary', async () => {
      const params = createPurchaseParams(
        user.address,
        [assets[2].assetId],
        [1]
      );

      await inGameAssetMarketplaceUser.purchase(...params, {
        value: assets[2].ethPrice
      });

      const balance = await ethers.provider.getBalance(
        inGameAssetMarketplace.address
      );

      await expect(() =>
        inGameAssetMarketplaceBeneficiary.withdrawEth(balance)
      ).changeEtherBalances(
        [beneficiary, inGameAssetMarketplaceUser],
        [
          ethers.BigNumber.from(assets[2].ethPrice),
          ethers.BigNumber.from(assets[2].ethPrice).mul(-1)
        ]
      );
    });

    it('should revert if sender is not beneficiary', async () => {
      await expect(
        inGameAssetMarketplaceUser.withdrawEth(1)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${BENEFICIARY_ROLE}`
      );
    });
  });

  describe('withdrawErc20', () => {
    it('should withdraw ERC20 from the contract for beneficiary', async () => {
      const params = createPurchaseParams(
        user.address,
        [assets[0].assetId],
        [1]
      );

      await inGameAssetMarketplaceUser.purchase(...params);

      const balance = await erc20_1.balanceOf(inGameAssetMarketplace.address);

      await expect(() =>
        inGameAssetMarketplaceBeneficiary.withdrawErc20(
          erc20_1.address,
          balance
        )
      ).changeTokenBalances(
        erc20_1,
        [beneficiary, inGameAssetMarketplaceUser],
        [
          ethers.BigNumber.from(assets[0].erc20Price),
          ethers.BigNumber.from(assets[0].erc20Price).mul(-1)
        ]
      );
    });

    it('should revert if sender is not beneficiary', async () => {
      await expect(
        inGameAssetMarketplaceUser.withdrawErc20(erc20_1.address, 1)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${BENEFICIARY_ROLE}`
      );
    });
  });

  describe('setSigner', () => {
    it('should set signer', async () => {
      await inGameAssetMarketplaceAdmin.setSigner(user.address);
      expect(await inGameAssetMarketplace.getSigner()).to.equal(user.address);
    });

    it('should revert if not default admin', async () => {
      await expect(
        inGameAssetMarketplaceUser.setSigner(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setTrustedForwarder', () => {
    it('should set trusted forwarder', async () => {
      await inGameAssetMarketplaceAdmin.setTrustedForwarder(user.address);
      expect(await inGameAssetMarketplace.getTrustedForwarder()).to.equal(
        user.address
      );
    });

    it('should revert if not default admin', async () => {
      await expect(
        inGameAssetMarketplaceUser.setTrustedForwarder(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('pause', () => {
    it('should pause', async () => {
      await inGameAssetMarketplacePauser.pause();
      expect(await inGameAssetMarketplace.paused()).to.be.true;
      await inGameAssetMarketplacePauser.unpause();
      expect(await inGameAssetMarketplace.paused()).to.be.false;
    });

    it('should revert if not pauser', async () => {
      await expect(inGameAssetMarketplaceUser.pause()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });
});
