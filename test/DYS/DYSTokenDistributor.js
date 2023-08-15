const { expect } = require('chai');
const Web3 = require('web3');
const { ethers, upgrades } = require('hardhat');
const web3 = new Web3();
const {
  TREASURER_ROLE,
  CLAIM_ADMIN_ROLE,
  DEFAULT_ADMIN_ROLE,
  PAUSER_ROLE,
  NULL_ADDRESS,
  mockSigner,
  mockPrivateKey,
  mockPrivateKey2
} = require('../utils/constants');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const createClaimParams = (
  sender,
  totalRewards,
  privateKey = mockPrivateKey
) => {
  const hash = web3.utils.soliditySha3Raw(
    { type: 'address', value: sender },
    { type: 'uint256', value: totalRewards }
  );
  const { signature, messageHash } = web3.eth.accounts.sign(hash, privateKey);
  return [totalRewards, messageHash, signature];
};

const MAX_CLAIM_PER_TRANSACTION = 100;
const MIN_CLAIM_FREQUENCY_PER_ACCOUNT = 60;
const GLOBAL_DAILY_CLAIM_LIMIT = 300;

describe('DYSTokenDistributor', () => {
  let DysTokenFactory;
  let DysTokenDistributorFactory;
  let dysToken;
  let dysTokenDistributor;
  let dysTokenDistributorAdmin;
  let dysTokenDistributorTreasurer;
  let dysTokenDistributorClaimAdmin;
  let dysTokenDistributorPauser;
  let dysTokenDistributorUser;
  let deployer;
  let admin;
  let treasurer;
  let claimAdmin;
  let pauser;
  let user;

  before(async () => {
    DysTokenFactory = await ethers.getContractFactory('DYSToken');
    DysTokenDistributorFactory = await ethers.getContractFactory(
      'DYSTokenDistributor'
    );
  });

  beforeEach(async () => {
    [deployer, admin, treasurer, claimAdmin, pauser, user] =
      await ethers.getSigners();

    dysToken = await DysTokenFactory.deploy(deployer.address, 1_000_000);
    await dysToken.deployed();

    dysTokenDistributor = await upgrades.deployProxy(
      DysTokenDistributorFactory,
      [
        admin.address,
        pauser.address,
        treasurer.address,
        claimAdmin.address,
        NULL_ADDRESS,
        dysToken.address,
        (await ethers.provider.getBlock('latest')).timestamp,
        mockSigner
      ]
    );
    await dysTokenDistributor.deployed();
    dysTokenDistributorUser = dysTokenDistributor.connect(user);
    dysTokenDistributorAdmin = dysTokenDistributor.connect(admin);
    dysTokenDistributorTreasurer = dysTokenDistributor.connect(treasurer);
    dysTokenDistributorClaimAdmin = dysTokenDistributor.connect(claimAdmin);
    dysTokenDistributorPauser = dysTokenDistributor.connect(pauser);

    await dysToken.transfer(dysTokenDistributor.address, 1_000_000);

    await dysTokenDistributorClaimAdmin.setMaxClaimPerTransaction(
      MAX_CLAIM_PER_TRANSACTION
    );
    await dysTokenDistributorClaimAdmin.setMinClaimFrequencyPerAccount(
      MIN_CLAIM_FREQUENCY_PER_ACCOUNT
    );
    await dysTokenDistributorClaimAdmin.setGlobalDailyClaimLimit(
      GLOBAL_DAILY_CLAIM_LIMIT
    );
  });

  describe('claim', () => {
    it('should claim tokens successfully', async () => {
      const func = (totalRewards = 100) =>
        dysTokenDistributorUser.claim(
          ...createClaimParams(user.address, totalRewards)
        );

      await expect(func).changeTokenBalances(
        dysToken,
        [user, dysTokenDistributor],
        [100, -100]
      );

      await time.increase(MIN_CLAIM_FREQUENCY_PER_ACCOUNT);

      await expect(func(150))
        .to.emit(dysTokenDistributor, 'Claimed')
        .withArgs(user.address, 50, 150);
    });
    it('should revert if trying to claim more than max claim per transaction', async () => {
      await expect(
        dysTokenDistributorUser.claim(
          ...createClaimParams(user.address, MAX_CLAIM_PER_TRANSACTION + 1)
        )
      ).to.be.revertedWith(
        'DYSTokenDistributor: Claim amount exceeds max claim per transaction'
      );
    });
    it('should revert if claimer has claimed within the minimum frequency', async () => {
      const func = () =>
        dysTokenDistributorUser.claim(...createClaimParams(user.address, 100));

      await func();

      await expect(func()).to.be.revertedWith(
        'DYSTokenDistributor: Last claim was too recent'
      );
    });
    it('should revert if no new rewards to claim', async () => {
      const func = () =>
        dysTokenDistributorUser.claim(...createClaimParams(user.address, 100));

      await func();

      await time.increase(MIN_CLAIM_FREQUENCY_PER_ACCOUNT);

      await expect(func()).to.be.revertedWith(
        'DYSTokenDistributor: No new rewards to claim'
      );
    });
    it('should revert claim amount exceeds global daily claim limit', async () => {
      let totalRewards = MAX_CLAIM_PER_TRANSACTION;
      while (true) {
        if (totalRewards > GLOBAL_DAILY_CLAIM_LIMIT) {
          await expect(
            dysTokenDistributorUser.claim(
              ...createClaimParams(user.address, totalRewards)
            )
          ).to.be.revertedWith(
            'DYSTokenDistributor: Claim amount exceeds global daily claim limit'
          );
          break;
        }
        await dysTokenDistributorUser.claim(
          ...createClaimParams(user.address, totalRewards)
        );
        totalRewards += MAX_CLAIM_PER_TRANSACTION;
        await time.increase(MIN_CLAIM_FREQUENCY_PER_ACCOUNT);
      }
    });
    it('should revert if signed with invalid private key', async () => {
      await expect(
        dysTokenDistributorUser.claim(
          ...createClaimParams(user.address, 100, mockPrivateKey2)
        )
      ).to.be.revertedWith(
        'DYSTokenDistributor: Message was not signed by signer'
      );
    });
    it('should revert in case of hash mismatch', async () => {
      const params = createClaimParams(user.address, 100);

      // total rewards mismatch
      await expect(
        dysTokenDistributorUser.claim(80, ...params.slice(1))
      ).to.be.revertedWith('DYSTokenDistributor: Hash mismatch');

      // address mismatch
      await expect(
        dysTokenDistributorAdmin.claim(...params)
      ).to.be.revertedWith('DYSTokenDistributor: Hash mismatch');
    });
    it('should revert if paused', async () => {
      await dysTokenDistributorPauser.pause();
      const func = () =>
        dysTokenDistributorUser.claim(...createClaimParams(user.address, 100));

      await expect(func()).to.be.revertedWith('Pausable: paused');

      await dysTokenDistributorPauser.unpause();

      await func();
    });
  });
  describe('withdrawErc20', () => {
    it('should withdraw erc20 tokens successfully', async () => {
      const func = () =>
        dysTokenDistributorTreasurer.withdrawErc20(
          100,
          dysToken.address,
          treasurer.address
        );

      await expect(func).changeTokenBalances(
        dysToken,
        [dysTokenDistributor, treasurer],
        [-100, 100]
      );
    });
    it('should revert if not called by treasurer', async () => {
      await expect(
        dysTokenDistributorAdmin.withdrawErc20(
          100,
          dysToken.address,
          treasurer.address
        )
      ).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${TREASURER_ROLE}`
      );
    });
  });
  describe('pause', () => {
    it('should revert if not called by pauser', async () => {
      await expect(dysTokenDistributorAdmin.pause()).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });
  describe('setMaxClaimPerTransaction', () => {
    it('should set max claim per transaction successfully', async () => {
      await dysTokenDistributorClaimAdmin.setMaxClaimPerTransaction(150);

      expect(await dysTokenDistributor.maxClaimPerTransaction()).to.equal(150);
    });
    it('should revert if not called by claim admin', async () => {
      await expect(
        dysTokenDistributorAdmin.setMaxClaimPerTransaction(100)
      ).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${CLAIM_ADMIN_ROLE}`
      );
    });
  });
  describe('setMinClaimFrequencyPerAccount', () => {
    it('should set min claim frequency per account successfully', async () => {
      await dysTokenDistributorClaimAdmin.setMinClaimFrequencyPerAccount(120);

      expect(await dysTokenDistributor.minClaimFrequencyPerAccount()).to.equal(
        120
      );
    });
    it('should revert if not called by claim admin', async () => {
      await expect(
        dysTokenDistributorAdmin.setMinClaimFrequencyPerAccount(120)
      ).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${CLAIM_ADMIN_ROLE}`
      );
    });
  });
  describe('setGlobalDailyClaimLimit', () => {
    it('should set global daily claim limit successfully', async () => {
      await dysTokenDistributorClaimAdmin.setGlobalDailyClaimLimit(150);

      expect(await dysTokenDistributor.globalDailyClaimLimit()).to.equal(150);
    });
    it('should revert if not called by claim admin', async () => {
      await expect(
        dysTokenDistributorAdmin.setGlobalDailyClaimLimit(120)
      ).to.be.revertedWith(
        `AccessControl: account ${admin.address.toLowerCase()} is missing role ${CLAIM_ADMIN_ROLE}`
      );
    });
  });
  describe('setTrustedForwarder', () => {
    it('should set trusted forwarder successfully', async () => {
      await dysTokenDistributorAdmin.setTrustedForwarder(deployer.address);

      expect(await dysTokenDistributor.getTrustedForwarder()).to.equal(
        deployer.address
      );
    });
    it('should revert if not called by claim admin', async () => {
      await expect(
        dysTokenDistributorUser.setTrustedForwarder(deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });
  describe('setSigner', () => {
    it('should set signer successfully', async () => {
      await dysTokenDistributorAdmin.setSigner(deployer.address);

      expect(await dysTokenDistributor.getSigner()).to.equal(deployer.address);
    });
    it('should revert if not called by claim admin', async () => {
      await expect(
        dysTokenDistributorUser.setSigner(deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });
});
