const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const {
  NULL_ADDRESS,
  mockSigner,
  mockPrivateKey,
  mockPrivateKey2
} = require('../utils/constants');
const { keccak256, toUtf8Bytes } = ethers.utils;
const Web3 = require('web3');
const web3 = new Web3();

const addSeriesToItemsAndMarketplace = async (
  inGameItems,
  inGameItemMarketplace,
  erc20_1,
  erc20_2
) => {
  const item1 = {
    itemId: 1,
    itemType: 1,
    slots: 2,
    series: [
      {
        itemSeriesId: 0,
        editionSize: 20,
        ethPrice: 0,
        erc20Address: erc20_1.address,
        erc20Price: web3.utils.toWei('100', 'ether')
      },
      {
        itemSeriesId: 1,
        editionSize: 20,
        ethPrice: 0,
        erc20Address: erc20_2.address,
        erc20Price: web3.utils.toWei('150', 'ether')
      }
    ]
  };
  const item2 = {
    itemId: 2,
    itemType: 4,
    slots: 3,
    series: [
      {
        itemSeriesId: 0,
        editionSize: 10,
        ethPrice: web3.utils.toWei('0.5', 'ether'),
        erc20Address: NULL_ADDRESS,
        erc20Price: 0
      }
    ]
  };
  const item3 = {
    itemId: 3,
    itemType: 2,
    slots: 1,
    series: [
      {
        itemSeriesId: 0,
        editionSize: 100,
        ethPrice: web3.utils.toWei('0.08', 'ether'),
        erc20Address: NULL_ADDRESS,
        erc20Price: 0
      }
    ]
  };

  const inGameItemsSeries = [];
  const inGameItemMarketplaceSeries = [];

  for (const item of [item1, item2, item3]) {
    for (const series of item.series) {
      inGameItemsSeries.push({
        itemId: item.itemId,
        itemType: item.itemType,
        slots: item.slots,
        itemSeriesId: series.itemSeriesId,
        editionSize: series.editionSize
      });
      inGameItemMarketplaceSeries.push({
        itemId: item.itemId,
        itemSeriesId: series.itemSeriesId,
        ethPrice: series.ethPrice,
        erc20Address: series.erc20Address,
        erc20Price: series.erc20Price,
        active: true
      });
    }
  }

  await inGameItems.setupItemSeries(inGameItemsSeries);
  await inGameItemMarketplace.setupItemSeriesPricing(
    inGameItemMarketplaceSeries
  );

  return [inGameItemsSeries, inGameItemMarketplaceSeries];
};

const createPurchaseParams = (
  sender,
  itemIds,
  itemSeriesIds,
  qtys,
  privateKey = mockPrivateKey
) => {
  const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  const hash = web3.utils.soliditySha3Raw(
    { type: 'address', value: sender },
    { type: 'uint256[]', value: itemIds },
    { type: 'uint256[]', value: itemSeriesIds },
    { type: 'uint256[]', value: qtys },
    { type: 'bytes32', value: nonce }
  );
  const { signature, messageHash } = web3.eth.accounts.sign(hash, privateKey);
  return [itemIds, itemSeriesIds, qtys, nonce, messageHash, signature];
};

describe('InGameItemMarketplace', () => {
  let InGameItemMarketplaceFactory;
  let InGameItemsFactory;
  let MockERC20;
  let inGameItemMarketplace;
  let inGameItems;
  let erc20_1;
  let erc20_2;
  let inGameItemsAdmin;
  let inGameItemsItemAdmin;
  let inGameItemMarketplaceAdmin;
  let inGameItemMarketplacePauser;
  let inGameItemMarketplaceBeneficiary;
  let inGameItemMarketplaceStoreAdmin;
  let inGameItemMarketplaceUser;
  let inGameItemMarketplaceSeries;
  let inGameItemsSeries;
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
  const MINTE_ROLE = keccak256(toUtf8Bytes('MINTER_ROLE')).toLowerCase();

  before(async () => {
    InGameItemMarketplaceFactory = await ethers.getContractFactory(
      'InGameItemMarketplace'
    );
    InGameItemsFactory = await ethers.getContractFactory('InGameItems');
    MockERC20 = await ethers.getContractFactory('MockERC20');
  });

  beforeEach(async () => {
    [deployer, admin, pauser, beneficiary, storeAdmin, user] =
      await ethers.getSigners();

    inGameItems = await upgrades.deployProxy(InGameItemsFactory, [
      'Dystopi In Game Item NFTs',
      'DNFT',
      admin.address,
      pauser.address,
      beneficiary.address,
      storeAdmin.address,
      NULL_ADDRESS,
      ''
    ]);
    await inGameItems.deployed();
    inGameItemsAdmin = inGameItems.connect(admin);
    inGameItemsItemAdmin = inGameItems.connect(storeAdmin);

    inGameItemMarketplace = await InGameItemMarketplaceFactory.deploy(
      admin.address,
      pauser.address,
      storeAdmin.address,
      beneficiary.address,
      mockSigner,
      inGameItems.address,
      NULL_ADDRESS
    );
    await inGameItemMarketplace.deployed();
    inGameItemMarketplaceAdmin = await inGameItemMarketplace.connect(admin);
    inGameItemMarketplacePauser = await inGameItemMarketplace.connect(pauser);
    inGameItemMarketplaceBeneficiary = await inGameItemMarketplace.connect(
      beneficiary
    );
    inGameItemMarketplaceStoreAdmin = await inGameItemMarketplace.connect(
      storeAdmin
    );
    inGameItemMarketplaceUser = await inGameItemMarketplace.connect(user);

    // granting MINTE_ROLE to inGameItemMarketplace
    await inGameItemsAdmin.grantRole(MINTE_ROLE, inGameItemMarketplace.address);

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
      .approve(inGameItemMarketplace.address, ethers.constants.MaxUint256);

    // approve erc20_2 for user to spend all
    await erc20_2
      .connect(user)
      .approve(inGameItemMarketplace.address, ethers.constants.MaxUint256);

    [inGameItemsSeries, inGameItemMarketplaceSeries] =
      await addSeriesToItemsAndMarketplace(
        inGameItemsItemAdmin,
        inGameItemMarketplaceStoreAdmin,
        erc20_1,
        erc20_2
      );
  });

  describe('purchase', () => {
    it('should purchase one with only ETH', async () => {
      await expect(() =>
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[2].itemId],
            [inGameItemMarketplaceSeries[2].itemSeriesId],
            [1]
          ),
          {
            value: ethers.BigNumber.from(
              inGameItemMarketplaceSeries[2].ethPrice
            )
          }
        )
      ).changeEtherBalances(
        [user, inGameItemMarketplace],
        [
          ethers.BigNumber.from(inGameItemMarketplaceSeries[2].ethPrice).mul(
            -1
          ),
          ethers.BigNumber.from(inGameItemMarketplaceSeries[2].ethPrice)
        ]
      );

      expect(await inGameItems.balanceOf(user.address)).to.equal(1);
    });

    it('should purchase one with only ERC20', async () => {
      await expect(() =>
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[0].itemId],
            [inGameItemMarketplaceSeries[0].itemSeriesId],
            [1]
          )
        )
      ).changeTokenBalances(
        erc20_1,
        [user, inGameItemMarketplace],
        [
          ethers.BigNumber.from(inGameItemMarketplaceSeries[0].erc20Price).mul(
            -1
          ),
          ethers.BigNumber.from(inGameItemMarketplaceSeries[0].erc20Price)
        ]
      );

      expect(await inGameItems.balanceOf(user.address)).to.equal(1);
    });

    it('should purchase several with both ETH and ERC20', async () => {
      const ethSpent = ethers.BigNumber.from(
        inGameItemMarketplaceSeries[2].ethPrice
      )
        .mul(2)
        .add(
          ethers.BigNumber.from(inGameItemMarketplaceSeries[3].ethPrice).mul(2)
        );

      const spent1 = ethers.BigNumber.from(
        inGameItemMarketplaceSeries[0].erc20Price
      ).mul(2);

      const spent2 = ethers.BigNumber.from(
        inGameItemMarketplaceSeries[1].erc20Price
      ).mul(2);

      const func = () =>
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [
              inGameItemMarketplaceSeries[0].itemId,
              inGameItemMarketplaceSeries[1].itemId,
              inGameItemMarketplaceSeries[2].itemId,
              inGameItemMarketplaceSeries[3].itemId
            ],
            [
              inGameItemMarketplaceSeries[0].itemSeriesId,
              inGameItemMarketplaceSeries[1].itemSeriesId,
              inGameItemMarketplaceSeries[2].itemSeriesId,
              inGameItemMarketplaceSeries[3].itemSeriesId
            ],
            [2, 2, 2, 2]
          ),
          {
            value: ethSpent
          }
        );

      await expect(func).changeEtherBalances(
        [user, inGameItemMarketplace],
        [ethSpent.mul(-1), ethSpent]
      );

      await expect(func).changeTokenBalances(
        erc20_1,
        [user, inGameItemMarketplace],
        [spent1.mul(-1), spent1]
      );

      await expect(func).changeTokenBalances(
        erc20_2,
        [user, inGameItemMarketplace],
        [spent2.mul(-1), spent2]
      );

      await expect(func).changeTokenBalance(inGameItems, user, 8);
    });

    it('should revert if the user does not have enough ETH', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[2].itemId],
            [inGameItemMarketplaceSeries[2].itemSeriesId],
            [1]
          ),
          {
            value: ethers.BigNumber.from(
              inGameItemMarketplaceSeries[2].ethPrice
            ).sub(1)
          }
        )
      ).to.be.revertedWith('InGameItemMarketplace: ETH price mismatch');
    });

    it('should revert if the user does not have enough ERC20', async () => {
      inGameItemMarketplaceSeries[0].erc20Price = web3.utils.toWei(
        '100000000000000000000000000000',
        'ether'
      );
      inGameItemMarketplaceStoreAdmin.setupItemSeriesPricing(
        inGameItemMarketplaceSeries
      );

      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[0].itemId],
            [inGameItemMarketplaceSeries[0].itemSeriesId],
            [1]
          )
        )
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('should revert if trying to purchase 0 tokens', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[0].itemId],
            [inGameItemMarketplaceSeries[0].itemSeriesId],
            [0]
          )
        )
      ).to.be.revertedWith('InGameItemMarketplace: Cannot purchase 0 tokens');
    });

    it('should revert if array length mismatch', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[0].itemId],
            [inGameItemMarketplaceSeries[0].itemSeriesId],
            [1, 1]
          )
        )
      ).to.be.revertedWith('InGameItemMarketplace: Array length mismatch');
    });

    it('should revert if message was not signed by signer', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(
            user.address,
            [inGameItemMarketplaceSeries[0].itemId],
            [inGameItemMarketplaceSeries[0].itemSeriesId],
            [1],
            mockPrivateKey2
          )
        )
      ).to.be.revertedWith(
        'InGameItemMarketplace: Message was not signed by signer'
      );
    });

    it('should revert if nonce was already used', async () => {
      const params = createPurchaseParams(
        user.address,
        [inGameItemMarketplaceSeries[0].itemId],
        [inGameItemMarketplaceSeries[0].itemSeriesId],
        [1]
      );

      await inGameItemMarketplaceUser.purchase(...params);

      await expect(
        inGameItemMarketplaceUser.purchase(...params)
      ).to.be.revertedWith('InGameItemMarketplace: Nonce was already used');
    });

    it('should revert if hash mismatch', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(NULL_ADDRESS, [1], [0], [1])
        )
      ).to.be.revertedWith('InGameItemMarketplace: Hash mismatch');
    });

    it('should revert if paused', async () => {
      await inGameItemMarketplacePauser.pause();

      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [1], [0], [1])
        )
      ).to.be.revertedWith('Pausable: paused');

      await inGameItemMarketplacePauser.unpause();

      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [1], [0], [1])
        )
      ).to.not.be.reverted;
    });

    it('should revert if item series Id out of bounds', async () => {
      await expect(
        inGameItemMarketplaceUser.purchase(
          ...createPurchaseParams(user.address, [20], [0], [1])
        )
      ).to.be.revertedWith(
        'InGameItemMarketplace: Item series ID out of bounds'
      );
    });
  });

  describe('setupItemSeriesPricing', () => {
    it('should add series to the marketplace', async () => {
      for (const series of inGameItemMarketplaceSeries) {
        const itemSeries = await inGameItemMarketplace.getItemSeriesPricing(
          series.itemId,
          series.itemSeriesId
        );
        expect(itemSeries).to.deep.equal([
          ethers.BigNumber.from(series.ethPrice),
          ethers.BigNumber.from(series.erc20Price),
          series.erc20Address,
          series.active
        ]);
      }
    });

    it('should revert if trying to add series with invalid series id', async () => {
      inGameItemMarketplaceSeries[1].itemSeriesId = 3;
      await expect(
        inGameItemMarketplaceStoreAdmin.setupItemSeriesPricing(
          inGameItemMarketplaceSeries
        )
      ).to.be.revertedWith('InGameItemMarketplace: Item series ID mismatch');
    });

    it('should revert if trying to add series with invalid price config', async () => {
      inGameItemMarketplaceSeries[0].erc20Price = 0;
      inGameItemMarketplaceSeries[0].ethPrice = 0;
      await expect(
        inGameItemMarketplaceStoreAdmin.setupItemSeriesPricing(
          inGameItemMarketplaceSeries
        )
      ).to.be.revertedWith(
        'InGameItemMarketplace: Price must be defined in either an ERC20 or ETH'
      );
    });

    it('should revert if not store admin', async () => {
      await expect(
        inGameItemMarketplaceUser.setupItemSeriesPricing([])
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${STORE_ADMIN_ROLE}`
      );
    });
  });

  describe('activateItemSeries', () => {
    it('should deactivate a list of item series than activates them again', async () => {
      await inGameItemMarketplaceStoreAdmin.activateItemSeries(
        false,
        inGameItemMarketplaceSeries.map((s) => s.itemId),
        inGameItemMarketplaceSeries.map((s) => s.itemSeriesId)
      );

      for (const series of inGameItemMarketplaceSeries) {
        const itemSeries = await inGameItemMarketplace.getItemSeriesPricing(
          series.itemId,
          series.itemSeriesId
        );
        expect(itemSeries[3]).to.be.false;
      }

      await inGameItemMarketplaceStoreAdmin.activateItemSeries(
        true,
        inGameItemMarketplaceSeries.map((s) => s.itemId),
        inGameItemMarketplaceSeries.map((s) => s.itemSeriesId)
      );

      for (const series of inGameItemMarketplaceSeries) {
        const itemSeries = await inGameItemMarketplace.getItemSeriesPricing(
          series.itemId,
          series.itemSeriesId
        );
        expect(itemSeries[3]).to.be.true;
      }
    });

    it('should revert if itemIds and itemSeriesIds are not the same length', async () => {
      await expect(
        inGameItemMarketplaceStoreAdmin.activateItemSeries(
          true,
          [1, 2, 3],
          [1, 2]
        )
      ).to.be.revertedWith('InGameItemMarketplace: Array length mismatch');
    });

    it('should revert if not store admin', async () => {
      await expect(
        inGameItemMarketplaceUser.activateItemSeries(true, [1], [1])
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${STORE_ADMIN_ROLE}`
      );
    });
  });

  describe('withdrawEth', () => {
    it('should withdraw ETH from the contract for beneficiary', async () => {
      const params = createPurchaseParams(
        user.address,
        [inGameItemMarketplaceSeries[2].itemId],
        [inGameItemMarketplaceSeries[2].itemSeriesId],
        [1]
      );

      await inGameItemMarketplaceUser.purchase(...params, {
        value: inGameItemMarketplaceSeries[2].ethPrice
      });

      const balance = await ethers.provider.getBalance(
        inGameItemMarketplace.address
      );

      await expect(() =>
        inGameItemMarketplaceBeneficiary.withdrawEth(balance)
      ).changeEtherBalances(
        [beneficiary, inGameItemMarketplaceUser],
        [
          ethers.BigNumber.from(inGameItemMarketplaceSeries[2].ethPrice),
          ethers.BigNumber.from(inGameItemMarketplaceSeries[2].ethPrice).mul(-1)
        ]
      );
    });

    it('should revert if sender is not beneficiary', async () => {
      await expect(inGameItemMarketplaceUser.withdrawEth(1)).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${BENEFICIARY_ROLE}`
      );
    });
  });

  describe('withdrawErc20', () => {
    it('should withdraw ERC20 from the contract for beneficiary', async () => {
      const params = createPurchaseParams(
        user.address,
        [inGameItemMarketplaceSeries[0].itemId],
        [inGameItemMarketplaceSeries[0].itemSeriesId],
        [1]
      );

      await inGameItemMarketplaceUser.purchase(...params);

      const balance = await erc20_1.balanceOf(inGameItemMarketplace.address);

      await expect(() =>
        inGameItemMarketplaceBeneficiary.withdrawErc20(erc20_1.address, balance)
      ).changeTokenBalances(
        erc20_1,
        [beneficiary, inGameItemMarketplaceUser],
        [
          ethers.BigNumber.from(inGameItemMarketplaceSeries[0].erc20Price),
          ethers.BigNumber.from(inGameItemMarketplaceSeries[0].erc20Price).mul(
            -1
          )
        ]
      );
    });

    it('should revert if sender is not beneficiary', async () => {
      await expect(
        inGameItemMarketplaceUser.withdrawErc20(erc20_1.address, 1)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${BENEFICIARY_ROLE}`
      );
    });
  });

  describe('setSigner', () => {
    it('should set signer', async () => {
      await inGameItemMarketplaceAdmin.setSigner(user.address);
      expect(await inGameItemMarketplace.getSigner()).to.equal(user.address);
    });

    it('should revert if not default admin', async () => {
      await expect(
        inGameItemMarketplaceUser.setSigner(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setTrustedForwarder', () => {
    it('should set trusted forwarder', async () => {
      await inGameItemMarketplaceAdmin.setTrustedForwarder(user.address);
      expect(await inGameItemMarketplace.getTrustedForwarder()).to.equal(
        user.address
      );
    });

    it('should revert if not default admin', async () => {
      await expect(
        inGameItemMarketplaceUser.setTrustedForwarder(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('setInGameItems', () => {
    it('should set in game items', async () => {
      await inGameItemMarketplaceAdmin.setInGameItems(user.address);
      expect(await inGameItemMarketplace.getInGameItems()).to.equal(
        user.address
      );
    });

    it('should revert if not default admin', async () => {
      await expect(
        inGameItemMarketplaceUser.setInGameItems(user.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('pause', () => {
    it('should pause', async () => {
      await inGameItemMarketplacePauser.pause();
      expect(await inGameItemMarketplace.paused()).to.be.true;
      await inGameItemMarketplacePauser.unpause();
      expect(await inGameItemMarketplace.paused()).to.be.false;
    });

    it('should revert if not pauser', async () => {
      await expect(inGameItemMarketplaceUser.pause()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });
});
