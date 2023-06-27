const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const {
  NULL_ADDRESS,
  ITEM_ADMIN_ROLE,
  MINTER_ROLE,
  PAUSER_ROLE,
  DEFAULT_ADMIN_ROLE
} = require('../utils/constants');
const { keccak256, toUtf8Bytes } = ethers.utils;

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

describe('InGameItems', () => {
  let InGameItemsFactory;
  let inGameItems;
  let inGameItemsAdmin;
  let inGameItemsPauser;
  let inGameItemsMinter;
  let inGameItemsItemAdmin;
  let inGameItemsUser;
  let deployer;
  let admin;
  let pauser;
  let minter;
  let itemAdmin;
  let user;

  before(async () => {
    InGameItemsFactory = await ethers.getContractFactory('InGameItems');
  });

  beforeEach(async () => {
    [deployer, admin, pauser, minter, itemAdmin, user] =
      await ethers.getSigners();

    inGameItems = await upgrades.deployProxy(InGameItemsFactory, [
      'Dystopi In Game Item NFTs',
      'DNFT',
      admin.address,
      pauser.address,
      minter.address,
      itemAdmin.address,
      NULL_ADDRESS,
      ''
    ]);
    await inGameItems.deployed();
    inGameItemsAdmin = inGameItems.connect(admin);
    inGameItemsItemAdmin = inGameItems.connect(itemAdmin);
    inGameItemsPauser = inGameItems.connect(pauser);
    inGameItemsMinter = inGameItems.connect(minter);
    inGameItemsUser = inGameItems.connect(user);
  });

  const generateItem = (itemId, itemType, slots) => ({
    itemId,
    itemType,
    slots,
    rarity: randomIntFromInterval(1, 5)
  });

  const generateRandomItemSeries = (
    { itemId, itemType, slots, rarity },
    itemSeriesId
  ) => ({
    itemId,
    itemSeriesId,
    itemType,
    slots,
    rarity,
    editionSize: randomIntFromInterval(5, 100)
  });

  const addRandomItems = async () => {
    const itemsIn = [];
    const itemSeriesIn = [];
    for (let itemId = 1; itemId <= 5; itemId++) {
      const item = generateItem(itemId, randomIntFromInterval(1, 5), 1);
      const currentItemSeriesIn = generateRandomItemSeries(item, 0);
      itemSeriesIn.push(currentItemSeriesIn);
      itemsIn.push(item);
    }
    await inGameItemsItemAdmin.setupItems(itemsIn);
    await inGameItemsItemAdmin.setupItemSeries(itemSeriesIn);
    return [itemsIn, itemSeriesIn];
  };

  // test setupItems function
  describe('setupItems', () => {
    it('should add items', async () => {
      const itemsIn = [];
      for (let itemId = 1; itemId <= 5; itemId++) {
        itemsIn.push(generateItem(itemId, randomIntFromInterval(1, 5), 1));
      }
      await inGameItemsItemAdmin.setupItems(itemsIn);

      for (const item of itemsIn) {
        const itemOut = await inGameItems.items(item.itemId);
        expect(itemOut.itemId).to.equal(item.itemId);
        expect(itemOut.itemType).to.equal(item.itemType);
        expect(itemOut.slots).to.equal(item.slots);
      }
    });

    it('should revert if itemId is 0', async () => {
      const itemsIn = [generateItem(0, randomIntFromInterval(1, 5), 1)];
      await expect(inGameItemsItemAdmin.setupItems(itemsIn)).to.be.revertedWith(
        'InGameItems: Item id must be greater than 0'
      );
    });

    it('should revert if itemType is 0', async () => {
      const itemsIn = [generateItem(1, 0, 1)];
      await expect(inGameItemsItemAdmin.setupItems(itemsIn)).to.be.revertedWith(
        'InGameItems: Item type must be greater than 0'
      );
    });

    it('should revert if not called by item admin', async () => {
      await expect(inGameItemsUser.setupItems([])).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${ITEM_ADMIN_ROLE}`
      );
    });
  });

  describe('setupItemSeries', () => {
    it('successfully sets up items and itemSeries for new items and updates lastOccupiedTokenId', async () => {
      const [itemsIn, itemSeriesIn] = await addRandomItems();

      let lastOccupiedTokenIdCalculated = 0;

      for (let i = 0; i < itemsIn.length; i++) {
        const item = itemsIn[i];
        const itemFromContract = await inGameItems.items(item.itemId);

        expect(itemFromContract.itemId).to.equal(item.itemId);
        expect(itemFromContract.itemType).to.equal(item.itemType);
        expect(itemFromContract.slots).to.equal(item.slots);
      }

      for await (const currentItemSeriesIn of itemSeriesIn) {
        const currentItemSeries = await inGameItems.getItemSeries(
          currentItemSeriesIn.itemId,
          currentItemSeriesIn.itemSeriesId
        );

        expect(currentItemSeries.itemId.toNumber()).to.be.equal(
          currentItemSeriesIn.itemId
        );
        expect(currentItemSeries.itemType.toNumber()).to.be.equal(
          currentItemSeriesIn.itemType
        );
        expect(currentItemSeries.slots.toNumber()).to.be.equal(
          currentItemSeriesIn.slots
        );
        expect(currentItemSeries.editionSize.toNumber()).to.be.equal(
          currentItemSeriesIn.editionSize
        );
        expect(currentItemSeries.minted.toNumber()).to.be.equal(0);
        expect(currentItemSeries.startingTokenId.toNumber()).to.be.equal(
          lastOccupiedTokenIdCalculated + 1
        );

        lastOccupiedTokenIdCalculated += currentItemSeriesIn.editionSize;
      }

      // lastOccupiedTokenId is updated
      const lastOccupiedTokenId = (
        await inGameItems.lastOccupiedTokenId()
      ).toNumber();
      expect(lastOccupiedTokenId).to.be.equal(lastOccupiedTokenIdCalculated);
    });

    it('successfully adds another series to an itemId', async () => {
      const [itemsIn, itemSeriesIn] = await addRandomItems();

      for await (const currentItemSeriesIn of itemSeriesIn) {
        const item = itemsIn.find(
          ({ itemId }) => itemId === currentItemSeriesIn.itemId
        );

        const newSeriesIn = generateRandomItemSeries(
          item,
          currentItemSeriesIn.itemSeriesId + 1
        );

        const promise = await inGameItemsItemAdmin.setupItemSeries([
          newSeriesIn
        ]);

        await promise;

        const currentItemSeries = await inGameItems.getItemSeries(
          newSeriesIn.itemId,
          newSeriesIn.itemSeriesId
        );

        await expect(promise)
          .to.emit(inGameItems, 'ItemSeriesAdded')
          .withArgs(
            currentItemSeriesIn.itemId,
            currentItemSeriesIn.itemSeriesId + 1,
            currentItemSeries.startingTokenId.toNumber(),
            currentItemSeries.editionSize.toNumber()
          );

        expect(currentItemSeries.itemId.toNumber()).to.be.equal(
          newSeriesIn.itemId
        );
        expect(currentItemSeries.editionSize.toNumber()).to.be.equal(
          newSeriesIn.editionSize
        );
        expect(currentItemSeries.minted.toNumber()).to.be.equal(0);
      }
    });

    it('fails without access', async () => {
      const seriesIn = generateRandomItemSeries(generateItem(1, 2, 3), 0);
      await expect(inGameItems.setupItemSeries([seriesIn])).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${ITEM_ADMIN_ROLE}`
      );
    });

    it('fails when itemSeriesId is not matching', async () => {
      const item1 = generateItem(1, 2, 3);
      const item2 = generateItem(1, 2, 3);
      await inGameItemsItemAdmin.setupItems([item1]);
      const seriesIn1_1 = generateRandomItemSeries(item1, 1);

      await expect(
        inGameItemsItemAdmin.setupItemSeries([seriesIn1_1])
      ).to.be.revertedWith('InGameItems: Item series ID mismatch');

      const seriesIn2_0 = generateRandomItemSeries(item2, 0);
      const seriesIn2_2 = generateRandomItemSeries(item2, 2);

      await inGameItemsItemAdmin.setupItemSeries([seriesIn2_0]);
      await expect(
        inGameItemsItemAdmin.setupItemSeries([seriesIn2_2])
      ).to.be.revertedWith('InGameItems: Item series ID mismatch');
    });

    it('should fail if item does not exist', async () => {
      const seriesIn = generateRandomItemSeries(generateItem(1, 2, 3), 0);
      await expect(
        inGameItemsItemAdmin.setupItemSeries([seriesIn])
      ).to.be.revertedWith('InGameItems: Item does not exist');
    });
  });

  describe('mint', () => {
    it('mints 1 of 1 series, assigns the right ids', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();

      for (let i = 1; i <= 3; i++) {
        await expect(
          inGameItemsMinter.mint(
            user.address,
            [seriesIn[0].itemId],
            [seriesIn[0].itemSeriesId],
            [1]
          )
        )
          .to.emit(inGameItemsMinter, 'Transfer')
          .withArgs(NULL_ADDRESS, user.address, i);
      }
    });

    it('mints 5 of 5 series', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();

      const itemIds = [];
      const itemSeriesIds = [];
      const amounts = [];

      for (const currentSeriesIn of seriesIn) {
        itemIds.push(currentSeriesIn.itemId);
        itemSeriesIds.push(currentSeriesIn.itemSeriesId);
        amounts.push(5);
      }

      await inGameItemsMinter.mint(
        user.address,
        itemIds,
        itemSeriesIds,
        amounts
      );

      const userBalance = await inGameItemsUser.balanceOf(user.address);

      expect(userBalance.toNumber()).to.be.equal(5 * seriesIn.length);
    });

    it('cannot mnt if item does not exist', async () => {
      await expect(
        inGameItemsMinter.mint(user.address, [1], [0], [1])
      ).to.be.revertedWith('InGameItems: Item does not exist');
    });

    it('cannot mint more than the max from a token', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();

      let currentSeriesIn = seriesIn[0];

      await inGameItemsMinter.mint(
        user.address,
        [currentSeriesIn.itemId],
        [currentSeriesIn.itemSeriesId],
        [currentSeriesIn.editionSize]
      );

      await expect(
        inGameItemsMinter.mint(
          user.address,
          [currentSeriesIn.itemId],
          [currentSeriesIn.itemSeriesId],
          [1]
        )
      ).to.be.revertedWith(
        'InGameItems: Not enough tokens to mint from this series'
      );

      const currentItemSeries = await inGameItems.getItemSeries(
        currentSeriesIn.itemId,
        currentSeriesIn.itemSeriesId
      );
      expect(currentItemSeries.minted.toNumber()).to.be.equal(
        currentSeriesIn.editionSize
      );

      currentSeriesIn = seriesIn[1];

      await expect(
        inGameItemsMinter.mint(
          user.address,
          [currentSeriesIn.itemId],
          [currentSeriesIn.itemSeriesId],
          [currentSeriesIn.editionSize + 1]
        )
      ).to.be.revertedWith(
        'InGameItems: Not enough tokens to mint from this series'
      );
    });

    it('cannot mint with differing itemId, itemSeriesId, and amounts arrays', async () => {
      await expect(
        inGameItemsMinter.mint(user.address, [1, 2], [0], [1])
      ).to.be.revertedWith('InGameItems: Array length mismatch');
    });

    it('cannot mint without access', async () => {
      await expect(
        inGameItems.mint(user.address, [1], [0], [1])
      ).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${MINTER_ROLE}`
      );
    });
  });

  describe('setBaseURI', () => {
    it('sets the base URI and it is used in tokenURI queries', async () => {
      const baseURI = 'https://lol.com/nft/';

      await inGameItemsItemAdmin.setBaseURI(baseURI);

      const [itemsIn, seriesIn] = await addRandomItems();

      const currentSeriesIn = seriesIn[0];

      await inGameItemsMinter.mint(
        user.address,
        [currentSeriesIn.itemId],
        [currentSeriesIn.itemSeriesId],
        [1]
      );

      const tokenURI = await inGameItems.tokenURI(1);

      expect(tokenURI).to.be.equal(baseURI + 1);
    });

    it('fails without access', async () => {
      const baseURI = 'https://lol.com/nft/';

      await expect(inGameItems.setBaseURI(baseURI)).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${ITEM_ADMIN_ROLE}`
      );
    });
  });

  describe('pause', () => {
    it('pauses and unpauses transfers', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();

      const currentSeriesIn = seriesIn[0];

      await inGameItemsPauser.pause();

      await expect(
        inGameItemsMinter.mint(
          user.address,
          [currentSeriesIn.itemId],
          [currentSeriesIn.itemSeriesId],
          [1]
        )
      ).to.be.revertedWith('Pausable: paused');

      await inGameItemsPauser.unpause();

      await inGameItemsMinter.mint(
        user.address,
        [currentSeriesIn.itemId],
        [currentSeriesIn.itemSeriesId],
        [1]
      );
    });

    it('fails without access', async () => {
      await expect(inGameItems.pause()).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });

  describe('setTrustedForwarder', () => {
    it('can set trustedForwarder with access', async () => {
      await inGameItemsAdmin.setTrustedForwarder(user.address);

      await expect(
        inGameItems.setTrustedForwarder(deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });

  describe('getItem', () => {
    it('should get the item', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();
      const item = itemsIn[0];
      const itemFromContract = await inGameItems.getItem(item.itemId);

      expect(itemFromContract.itemId.toNumber()).to.be.equal(item.itemId);
      expect(itemFromContract.itemType.toNumber()).to.be.equal(item.itemType);
      expect(itemFromContract.slots.toNumber()).to.be.equal(item.slots);
    });

    it('should revert if itemId is 0', async () => {
      await expect(inGameItems.getItem(0)).to.be.revertedWith(
        'InGameItems: Item id must be greater than 0'
      );
    });

    it('should revert if item does not exist', async () => {
      await expect(inGameItems.getItem(1)).to.be.revertedWith(
        'InGameItems: Item does not exist'
      );
    });
  });

  describe('getItemSeries', () => {
    it('should get the item series', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();
      const series = seriesIn[0];
      const item = itemsIn.find(({ itemId }) => itemId === series.itemId);
      const seriesFromContract = await inGameItems.getItemSeries(
        series.itemId,
        series.itemSeriesId
      );

      expect(seriesFromContract.itemId.toNumber()).to.be.equal(series.itemId);
      expect(seriesFromContract.itemSeriesId.toNumber()).to.be.equal(
        series.itemSeriesId
      );
      expect(seriesFromContract.editionSize.toNumber()).to.be.equal(
        series.editionSize
      );
      expect(seriesFromContract.itemType.toNumber()).to.be.equal(item.itemType);
      expect(seriesFromContract.slots.toNumber()).to.be.equal(item.slots);
      expect(seriesFromContract.minted.toNumber()).to.be.equal(0);
    });

    it('should revert if item does not exist', async () => {
      await expect(inGameItems.getItemSeries(1, 0)).to.be.revertedWith(
        'InGameItems: Item does not exist'
      );
    });

    it('should revert if item series does not exist', async () => {
      const [itemsIn, seriesIn] = await addRandomItems();
      const item = itemsIn[0];
      await expect(
        inGameItems.getItemSeries(item.itemId, 10)
      ).to.be.revertedWith('InGameItems: itemSeriesId out of range');
    });
  });
});
