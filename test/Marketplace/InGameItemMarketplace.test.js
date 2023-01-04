const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const {
  NULL_ADDRESS,
  mockSigner,
  mockPrivateKey
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

const createPurchaseParams = (sender, itemIds, itemSeriesIds, qtys) => {
  const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  const hash = web3.utils.soliditySha3Raw(
    { type: 'address', value: sender },
    { type: 'uint256[]', value: itemIds },
    { type: 'uint256[]', value: itemSeriesIds },
    { type: 'uint256[]', value: qtys },
    { type: 'bytes32', value: nonce }
  );
  const { signature, messageHash } = web3.eth.accounts.sign(
    hash,
    mockPrivateKey
  );
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
  });

  describe('purchase', () => {
    it('should purchase one with only ETH', async () => {
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

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
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

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
  });

  describe('setupItemSeriesPricing', () => {
    it('should add series to the marketplace', async () => {
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

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
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

      inGameItemMarketplaceSeries[1].itemSeriesId = 3;
      await expect(
        inGameItemMarketplaceStoreAdmin.setupItemSeriesPricing(
          inGameItemMarketplaceSeries
        )
      ).to.be.revertedWith('InGameItemMarketplace: Item series ID mismatch');
    });
    it('should revert if trying to add series with invalid price config', async () => {
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

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
  });

  describe('activateItemSeries', () => {
    it('should deactivate a list of item series than activates them again', async () => {
      const [_, inGameItemMarketplaceSeries] =
        await addSeriesToItemsAndMarketplace(
          inGameItemsItemAdmin,
          inGameItemMarketplaceStoreAdmin,
          erc20_1,
          erc20_2
        );

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
  });
});
