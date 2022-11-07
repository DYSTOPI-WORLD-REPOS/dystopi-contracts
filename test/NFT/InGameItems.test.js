const { expect } = require("chai");
const { ethers, upgrades } = require('hardhat');
const {keccak256, toUtf8Bytes} = ethers.utils;

function randomIntFromInterval(min, max) { // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

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

  const DEFAULT_ADMIN_ROLE = NULL_ADDRESS;
  const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE')).toLowerCase();
  const ITEM_ADMIN_ROLE = keccak256(toUtf8Bytes('ITEM_ADMIN_ROLE')).toLowerCase();
  const MINTER_ROLE = keccak256(toUtf8Bytes('MINTER_ROLE')).toLowerCase();

  before(async () => {
    InGameItemsFactory = await ethers.getContractFactory('InGameItems');
  });

  beforeEach(async () => {
    [deployer, admin, pauser, minter, itemAdmin, user] = await ethers.getSigners();

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

  const generateRandomItemSeries = (itemId, itemSeriesId, itemType, slots) => ({
    itemId,
    itemSeriesId,
    itemType: itemType || randomIntFromInterval(1, 10),
    slots: slots || randomIntFromInterval(1, 3),
    editionSize: randomIntFromInterval(5, 100)
  });

  const addRandomItems = async () => {
    const itemSeriesIn = [];
    for (let itemId = 1; itemId <= 5; itemId++) {
      const currentItemSeriesIn = generateRandomItemSeries(itemId, 0);
      itemSeriesIn.push(currentItemSeriesIn);
    }
    await inGameItemsItemAdmin.setupItemSeries(itemSeriesIn);
    return itemSeriesIn;
  }

  describe('setupItemSeries', () => {
    it('successfully sets up itemSeries for new items', async () => {
      const itemSeriesIn = await addRandomItems();

      let lastOccupiedTokenIdCalculated = 0;

      for await (const currentItemSeriesIn of itemSeriesIn) {
        const currentItemSeries = await inGameItems.getItemSeries(
          currentItemSeriesIn.itemId,
          currentItemSeriesIn.itemSeriesId
        );

        expect(currentItemSeries.itemId.toNumber()).to.be.equal(currentItemSeriesIn.itemId);
        expect(currentItemSeries.itemType.toNumber()).to.be.equal(currentItemSeriesIn.itemType);
        expect(currentItemSeries.slots.toNumber()).to.be.equal(currentItemSeriesIn.slots);
        expect(currentItemSeries.editionSize.toNumber()).to.be.equal(currentItemSeriesIn.editionSize);
        expect(currentItemSeries.minted.toNumber()).to.be.equal(0);
        expect(currentItemSeries.startingTokenId.toNumber()).to.be.equal(lastOccupiedTokenIdCalculated + 1);

        lastOccupiedTokenIdCalculated += currentItemSeriesIn.editionSize;
      }

      // lastOccupiedTokenId is updated
      const lastOccupiedTokenId = (await inGameItems.lastOccupiedTokenId()).toNumber();
      expect(lastOccupiedTokenId).to.be.equal(lastOccupiedTokenIdCalculated);
    });

    it('successfully adds another series to an itemId', async () => {
      const itemSeriesIn = await addRandomItems();

      for await (const currentItemSeriesIn of itemSeriesIn) {
        const newSeriesIn = generateRandomItemSeries(
          currentItemSeriesIn.itemId,
          currentItemSeriesIn.itemSeriesId + 1,
          currentItemSeriesIn.itemType,
          currentItemSeriesIn.slots
        );
        const promise = await inGameItemsItemAdmin.setupItemSeries([newSeriesIn]);
        await promise;

        const currentItemSeries = await inGameItems.getItemSeries(newSeriesIn.itemId, newSeriesIn.itemSeriesId);

        await expect(promise)
          .to.emit(inGameItems, 'ItemSeriesAdded')
          .withArgs(
            currentItemSeriesIn.itemId,
            currentItemSeriesIn.itemSeriesId + 1,
            currentItemSeriesIn.itemType,
            currentItemSeriesIn.slots,
            currentItemSeries.startingTokenId.toNumber(),
            currentItemSeries.editionSize.toNumber()
          );

        expect(currentItemSeries.itemId.toNumber()).to.be.equal(newSeriesIn.itemId);
        expect(currentItemSeries.itemType.toNumber()).to.be.equal(newSeriesIn.itemType);
        expect(currentItemSeries.slots.toNumber()).to.be.equal(newSeriesIn.slots);
        expect(currentItemSeries.editionSize.toNumber()).to.be.equal(newSeriesIn.editionSize);
        expect(currentItemSeries.minted.toNumber()).to.be.equal(0);
      }
    });

    it('fails without access', async () => {
      const seriesIn = generateRandomItemSeries(1, 0);
      await expect(inGameItems.setupItemSeries([seriesIn]))
        .to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${ITEM_ADMIN_ROLE}`);
    });

    it('fails when itemSeriesId is not matching', async () => {
      const seriesIn1_1 = generateRandomItemSeries(1, 1);

      await expect(inGameItemsItemAdmin.setupItemSeries([seriesIn1_1]))
        .to.be.revertedWith('InGameItems: Item series ID mismatch');

      const seriesIn2_0 = generateRandomItemSeries(2, 0);
      const seriesIn2_2 = generateRandomItemSeries(2, 2);

      await inGameItemsItemAdmin.setupItemSeries([seriesIn2_0]);
      await expect(inGameItemsItemAdmin.setupItemSeries([seriesIn2_2]))
        .to.be.revertedWith('InGameItems: Item series ID mismatch');
    });

    it('fails if itemType or slots is not matching', async () => {
      const seriesIn = generateRandomItemSeries(1, 0);

      await inGameItemsItemAdmin.setupItemSeries([seriesIn]);

      const seriesInWrongItemType = generateRandomItemSeries(
        1,
        1,
        seriesIn.itemType + 1,
        seriesIn.slots
      );

      await expect(inGameItemsItemAdmin.setupItemSeries([seriesInWrongItemType]))
        .to.be.revertedWith('InGameItems: Item type mismatch');

      const seriesInWrongSlots = generateRandomItemSeries(
        1,
        1,
        seriesIn.itemType,
        seriesIn.slots + 1
      );

      await expect(inGameItemsItemAdmin.setupItemSeries([seriesInWrongSlots]))
        .to.be.revertedWith('InGameItems: Slots mismatch');
    });
  });

  describe('mint', () => {
    it('mints 1 of 1 series', async () => {
      const seriesIn = await addRandomItems();

      await expect(inGameItemsMinter.mint(user.address, [seriesIn[0].itemId], [seriesIn[0].itemSeriesId], [1]))
        .to.emit(inGameItemsMinter, 'Transfer')
        .withArgs(NULL_ADDRESS, user.address, 1);
    });

    it('mints 5 of 5 series', async () => {
      const seriesIn = await addRandomItems();

      const itemIds = [];
      const itemSeriesIds = [];
      const amounts = [];

      for (const currentSeriesIn of seriesIn) {
        itemIds.push(currentSeriesIn.itemId);
        itemSeriesIds.push(currentSeriesIn.itemSeriesId);
        amounts.push(5);
      }

      await inGameItemsMinter.mint(user.address, itemIds, itemSeriesIds, amounts);

      const userBalance = await inGameItemsUser.balanceOf(user.address);

      expect(userBalance.toNumber()).to.be.equal(5 * seriesIn.length);
    });

    it('cannot mint more than the max from a token', async () => {
      const seriesIn = await addRandomItems();

      let currentSeriesIn = seriesIn[0];

      await inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [currentSeriesIn.editionSize]);

      await expect(inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [1]))
        .to.be.revertedWith('InGameItems: Not enough tokens to mint from this series');

      const currentItemSeries = await inGameItems.getItemSeries(currentSeriesIn.itemId, currentSeriesIn.itemSeriesId);
      expect(currentItemSeries.minted.toNumber()).to.be.equal(currentSeriesIn.editionSize);

      currentSeriesIn = seriesIn[1];

      await expect(inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [currentSeriesIn.editionSize + 1]))
        .to.be.revertedWith('InGameItems: Not enough tokens to mint from this series');
    });

    it('cannot mint with differing itemId, itemSeriesId, and amounts arrays', async () => {
      await expect(inGameItemsMinter.mint(user.address, [1, 2], [0], [1]))
        .to.be.revertedWith('InGameItems: Array length mismatch');
    });

    it('cannot mint without access', async () => {
      await expect(inGameItems.mint(user.address, [1], [0], [1]))
        .to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${MINTER_ROLE}`);
    });
  });

  describe('setBaseURI', () => {
    it('sets the base URI and it is used in tokenURI queries', async () => {
      const baseURI = 'https://lol.com/nft/';

      await inGameItemsItemAdmin.setBaseURI(baseURI);

      const seriesIn = await addRandomItems();

      const currentSeriesIn = seriesIn[0];

      await inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [1]);

      const tokenURI = await inGameItems.tokenURI(1);

      expect(tokenURI).to.be.equal(baseURI + 1);
    });

    it('fails without access', async () => {
      const baseURI = 'https://lol.com/nft/';

      await expect(inGameItems.setBaseURI(baseURI))
        .to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${ITEM_ADMIN_ROLE}`);
    });
  });

  describe('pause', () => {
    it('pauses and unpauses transfers', async () => {
      const seriesIn = await addRandomItems();

      const currentSeriesIn = seriesIn[0];

      await inGameItemsPauser.pause();

      await expect(inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [1]))
        .to.be.revertedWith('Pausable: paused');

      await inGameItemsPauser.unpause();

      await inGameItemsMinter.mint(user.address, [currentSeriesIn.itemId], [currentSeriesIn.itemSeriesId], [1]);
    });

    it('fails without access', async () => {
      await expect(inGameItems.pause())
        .to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${PAUSER_ROLE}`);
    });
  });

  describe('setTrustedForwarder', () => {
    it('can set trustedForwarder with access', async () => {
      await inGameItemsAdmin.setTrustedForwarder(user.address);

      await expect(inGameItems.setTrustedForwarder(deployer.address))
        .to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`);
    });
  });
});
