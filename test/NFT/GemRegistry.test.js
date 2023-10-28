const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const {
  NULL_ADDRESS,
  GEM_ADMIN_ROLE,
  PAUSER_ROLE,
  DEFAULT_ADMIN_ROLE
} = require('../utils/constants');
const { generateItem, generateRandomItemSeries } = require('../utils/helpers');

const gemItemTypes = [1, 2, 3];
const gem1CompatibleTypes = [4, 5, 6];
const gem2CompatibleTypes = [7, 8, 9];
const gem3CompatibleTypes = [10, 11, 12];
const gemCompatibilityList = {
  1: gem1CompatibleTypes,
  2: gem2CompatibleTypes,
  3: gem3CompatibleTypes
};
const allTypes = [
  ...gemItemTypes,
  ...gem1CompatibleTypes,
  ...gem2CompatibleTypes,
  ...gem3CompatibleTypes
];
const slotsFromPerType = {
  1: NaN,
  2: NaN,
  3: NaN,
  4: 0,
  5: 1,
  6: 2,
  7: 0,
  8: 1,
  9: 2,
  10: 0,
  11: 1,
  12: 2
};
const itemIdPerTypeCount = 2;
const itemSeriesPerItemCount = 1;
const mintedEditions = 10;

/**
 * Creates item data for testing
 * Item structure is:
 * - Items, represented by itemId - a blueprint for an in-game item, such as a type of armour, etc.
 * - Every item has an itemType associated with it, it represents the kind of item it is - helmet, pistol, etc.
 * - Every item has a slotNumber associated with it, which is the number of gems that can be inserted into it (gems are items with specific itemTypes)
 * - Every item can have multiple series, represented by itemSeriesId - a series of x number of NFTs released of the item
 * - Every itemSeries has tokens associated with it, that is, NFTs that are minted from that itemSeries and item.
 * This function creates itemPerTypeCount number of items for each itemType, and itemSeriesPerItemCount number of itemSeries for each item, all of which series then mintedEdition number of tokens will be minted for testing
 * Slot numbers of items belonging to a type are incremented from slotsFromPerType
 * @returns {{itemSeries: *, items: unknown, itemTypeItemsMap: {}}}
 */
const generateItemData = () => {
  const itemTypeItemsMap = {};
  let itemId = 1;
  for (let typeIndex = 0; typeIndex < allTypes.length; typeIndex++) {
    const itemType = allTypes[typeIndex];
    for (let idIndex = 0; idIndex < itemIdPerTypeCount; idIndex++) {
      if (itemTypeItemsMap[itemType] === undefined) {
        itemTypeItemsMap[itemType] = [];
      }
      itemTypeItemsMap[itemType].push(
        generateItem(
          itemId,
          itemType,
          isNaN(slotsFromPerType[itemType])
            ? 0
            : slotsFromPerType[itemType] + idIndex
        )
      );
      for (
        let seriesIndex = 0;
        seriesIndex < itemSeriesPerItemCount;
        seriesIndex++
      ) {
        if (itemTypeItemsMap[itemType][idIndex].series === undefined) {
          itemTypeItemsMap[itemType][idIndex].series = [];
        }
        itemTypeItemsMap[itemType][idIndex].series.push(
          generateRandomItemSeries(
            itemTypeItemsMap[itemType][idIndex],
            seriesIndex
          )
        );
      }
      itemId++;
    }
  }

  const items = Object.values(itemTypeItemsMap).reduce((acc, curr) => {
    return [...acc, ...curr];
  }, []);

  return {
    itemTypeItemsMap,
    items,
    itemSeries: items.reduce((acc, curr) => {
      return [...acc, ...curr.series];
    }, [])
  };
};

describe('GemRegistry', () => {
  let InGameItemsFactory;
  let GameRegistryFactory;
  let inGameItems;
  let inGameItemsAdmin;
  let inGameItemsItemAdmin;
  let inGameItemsMinter;
  let inGameItemsUser;
  let gemRegistry;
  let gemRegistryAdmin;
  let gemRegistryPauser;
  let gemRegistryGemAdmin;
  let gemRegistryUser;
  let deployer;
  let admin;
  let pauser;
  let gemAdmin;
  let itemAdmin;
  let minter;
  let user;

  const { items, itemSeries, itemTypeItemsMap } = generateItemData();

  const itemIds = items.reduce(
    (arr, item) => [
      ...arr,
      ...Array.from({ length: item.series.length }, (_, i) => item.itemId)
    ],
    []
  );

  const itemSeriesIds = items.reduce(
    (arr, item) => [...arr, ...item.series.map((s) => s.itemSeriesId)],
    []
  );

  const qtys = Array.from(
    { length: itemSeriesIds.length },
    (_, i) => mintedEditions
  );

  before(async () => {
    InGameItemsFactory = await ethers.getContractFactory('InGameItems');
    GameRegistryFactory = await ethers.getContractFactory('GemRegistry');
  });

  beforeEach(async () => {
    [deployer, admin, pauser, gemAdmin, itemAdmin, minter, user] =
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
    inGameItemsAdmin = await inGameItems.connect(admin);
    inGameItemsItemAdmin = await inGameItems.connect(itemAdmin);
    inGameItemsMinter = await inGameItems.connect(minter);
    inGameItemsUser = await inGameItems.connect(user);

    gemRegistry = await upgrades.deployProxy(GameRegistryFactory, [
      admin.address,
      gemAdmin.address,
      pauser.address,
      inGameItems.address,
      NULL_ADDRESS
    ]);
    gemRegistryAdmin = await gemRegistry.connect(admin);
    gemRegistryPauser = await gemRegistry.connect(pauser);
    gemRegistryGemAdmin = await gemRegistry.connect(gemAdmin);
    gemRegistryUser = await gemRegistry.connect(user);

    await inGameItemsItemAdmin.setupItems(items);
    await inGameItemsItemAdmin.setupItemSeries(itemSeries);

    await inGameItemsMinter.mint(user.address, itemIds, itemSeriesIds, qtys);

    await gemRegistryGemAdmin.setupGemItemType(
      gemItemTypes[0],
      gem1CompatibleTypes
    );
    await gemRegistryGemAdmin.setupGemItemType(
      gemItemTypes[1],
      gem2CompatibleTypes
    );
    await gemRegistryGemAdmin.setupGemItemType(
      gemItemTypes[2],
      gem3CompatibleTypes
    );

    await inGameItemsUser.setApprovalForAll(gemRegistry.address, true);
  });

  describe('setupGemItemType', () => {
    it('should have itemTypes set up correctly', async () => {
      const gemItemTypesFromContract = await gemRegistry.gemItemTypes();
      expect(gemItemTypesFromContract.length).to.be.equal(gemItemTypes.length);

      for (let i = 0; i < gemItemTypes.length; i++) {
        expect(gemItemTypesFromContract[i].toNumber()).to.be.equal(
          gemItemTypes[i]
        );
        const gemItemTypeFromContract = await gemRegistry.gemItemType(i);
        expect(gemItemTypeFromContract).to.be.equal(gemItemTypes[i]);

        const compatibilityList = gemCompatibilityList[gemItemTypeFromContract];
        const compatibilityListFromContract =
          await gemRegistry.gemCompatibilityList(gemItemTypeFromContract);

        expect(compatibilityListFromContract.length).to.be.equal(
          compatibilityList.length
        );

        for (let j = 0; j < compatibilityListFromContract.length; j++) {
          expect(compatibilityListFromContract[j].toNumber()).to.be.equal(
            compatibilityList[j]
          );

          const gemCompatibilityByIndexFromContract =
            await gemRegistry.gemCompatibilityByIndex(
              gemItemTypeFromContract,
              j
            );

          expect(gemCompatibilityByIndexFromContract.toNumber()).to.be.equal(
            compatibilityList[j]
          );

          const gemCompatibilityFromContract =
            await gemRegistry.gemCompatibilityMap(
              gemItemTypeFromContract,
              compatibilityList[j]
            );

          expect(gemCompatibilityFromContract).to.be.equal(true);
        }
      }
    });
    it('should reset gemItemType correctly', async () => {
      const previousGemCompatibilityListFromContract =
        await gemRegistry.gemCompatibilityList(gemItemTypes[0]);

      await gemRegistryGemAdmin.setupGemItemType(
        gemItemTypes[0],
        gem2CompatibleTypes
      );

      const gemCompatibilityListFromContract =
        await gemRegistry.gemCompatibilityList(gemItemTypes[0]);

      expect(gemCompatibilityListFromContract.length).to.be.equal(
        gem2CompatibleTypes.length
      );

      for (let i = 0; i < gem2CompatibleTypes.length; i++) {
        expect(gemCompatibilityListFromContract[i].toNumber()).to.be.equal(
          gem2CompatibleTypes[i]
        );

        const gemCompatibilityFromContract =
          await gemRegistry.gemCompatibilityMap(
            gemItemTypes[0],
            gem2CompatibleTypes[i]
          );

        expect(gemCompatibilityFromContract).to.be.equal(true);
      }

      for (
        let i = 0;
        i < previousGemCompatibilityListFromContract.length;
        i++
      ) {
        const gemCompatibilityFromContract =
          await gemRegistry.gemCompatibilityMap(gemItemTypes[0], i);

        expect(gemCompatibilityFromContract).to.be.equal(false);
      }
    });
    it('should revert if not called by GEM_ADMIN_ROLE', async () => {
      await expect(
        gemRegistryUser.setupGemItemType(gemItemTypes[0], gem1CompatibleTypes)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${GEM_ADMIN_ROLE}`
      );
    });
    it('should revert if compatibleItemTypes is empty', async () => {
      await expect(
        gemRegistryGemAdmin.setupGemItemType(gemItemTypes[0], [])
      ).to.be.revertedWith(
        'GemRegistry: compatibleItemTypes must have length > 0'
      );
    });
  });
  describe('removeGemItemType', () => {
    it('should remove gemItemType correctly', async () => {
      await gemRegistryGemAdmin.removeGemItemType(gemItemTypes[0]);

      const gemItemTypesFromContract = await gemRegistry.gemItemTypes();
      expect(gemItemTypesFromContract.length).to.be.equal(
        gemItemTypes.length - 1
      );

      const emptyArray = await gemRegistry.gemCompatibilityList(
        gemItemTypes[0]
      );
      expect(emptyArray.length).to.be.equal(0);

      for (let i = 0; i < gemCompatibilityList[gemItemTypes[0]].length; i++) {
        const gemCompatibilityFromContract =
          await gemRegistry.gemCompatibilityMap(
            gemItemTypes[0],
            gemCompatibilityList[gemItemTypes[0]][i]
          );

        expect(gemCompatibilityFromContract).to.be.equal(false);
      }
    });
    it('should revert if not called by GEM_ADMIN_ROLE', async () => {
      await expect(
        gemRegistryUser.removeGemItemType(gemItemTypes[0])
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${GEM_ADMIN_ROLE}`
      );
    });
    it('should revert if gemItemType is not set', async () => {
      await expect(
        gemRegistryGemAdmin.removeGemItemType(999)
      ).to.be.revertedWith('GemRegistry: gemItemType is not set');
    });
  });
  describe('insertGem', () => {
    it('should insert a single gem into items with slots > 0 correctly', async () => {
      // this tests checks all itemType gemItemType compatibility combinations

      // iterating all gem types
      let gemItemTypeIndex = -1;
      for await (const [gemItemType, compatibleItemTypes] of Object.entries(
        gemCompatibilityList
      )) {
        // keeping track of this to ensure only one gem is inserted into each token
        gemItemTypeIndex++;
        // choosing the first gem item of a type to test
        const gemItem = itemTypeItemsMap[gemItemType][0];
        // mintedEditions nfts from this tokenId are of this gemItem
        let gemItemStartingTokenId = (
          await inGameItems.getItemSeries(gemItem.itemId, 0)
        ).startingTokenId.toNumber();

        // iterating all itemTypes compatible with gemItemType
        for await (const [
          compatibleItemTypeIndex,
          compatibleItemType
        ] of compatibleItemTypes.entries()) {
          // choosing an item of a type to test - 1, as the first item of every type has slots = 0
          const compatibleItem = itemTypeItemsMap[compatibleItemType][1];
          // get number of slots from contract
          const itemSlots = (
            await inGameItems.getItem(compatibleItem.itemId)
          ).slots.toNumber();

          // if item has slots, try insertion
          if (itemSlots > 0) {
            // get itemSeries of the item
            const compatibleItemSeries = await inGameItems.getItemSeries(
              compatibleItem.itemId,
              0
            );

            // from this id, mintedEditions nfts are of this item
            const compatibleStartingTokenId =
              compatibleItemSeries.startingTokenId.toNumber();

            // to ensure that only one gem is inserted into each token
            const compatibleTokenId =
              compatibleStartingTokenId + gemItemTypeIndex;

            // to ensure that each gem is inserted only once
            const gemTokenId = gemItemStartingTokenId + compatibleItemTypeIndex;

            const promise = gemRegistryUser.insertGem(
              compatibleTokenId,
              compatibleItem.itemId,
              0,
              gemTokenId,
              gemItem.itemId,
              0
            );

            // emitting Transfer and GemInserted events as expected

            await expect(promise)
              .to.emit(gemRegistry, 'GemInserted')
              .withArgs(compatibleTokenId, gemTokenId);

            await expect(promise)
              .to.emit(inGameItems, 'Transfer')
              .withArgs(user.address, NULL_ADDRESS, gemTokenId);

            await promise;

            const insertedGems = await gemRegistry.insertedGems(
              compatibleTokenId
            );

            const insertedGem = await gemRegistry.insertedGem(
              compatibleTokenId,
              0
            );

            // as expected, only one gem is inserted into each compatible token
            // and the tokenId of that is gemTokenId
            expect(insertedGems.length).to.be.equal(1);
            expect(insertedGem.toNumber()).to.be.equal(gemTokenId);
            expect(insertedGems[0].toNumber()).to.be.equal(gemTokenId);
          }
        }
      }
    });
    it('should revert if item has no more free slots', async () => {
      const gemItemType = 2;
      const type = 9;
      const item = itemTypeItemsMap[type][0];
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemStartingTokenId = gemItemSeries.startingTokenId.toNumber();
      const gemTokenIds = [
        gemStartingTokenId,
        gemStartingTokenId + 1,
        gemStartingTokenId + 2
      ];

      let insertedGemsFromContract = await gemRegistry.insertedGems(tokenId);

      expect(insertedGemsFromContract.length).to.be.equal(0);

      await gemRegistryUser.insertGem(
        tokenId,
        item.itemId,
        0,
        gemTokenIds[0],
        gemItem.itemId,
        0
      );

      insertedGemsFromContract = await gemRegistry.insertedGems(tokenId);

      expect(insertedGemsFromContract.length).to.be.equal(1);
      expect(insertedGemsFromContract[0].toNumber()).to.be.equal(
        gemTokenIds[0]
      );

      await gemRegistryUser.insertGem(
        tokenId,
        item.itemId,
        0,
        gemTokenIds[1],
        gemItem.itemId,
        0
      );

      insertedGemsFromContract = await gemRegistry.insertedGems(tokenId);

      expect(insertedGemsFromContract.length).to.be.equal(2);
      expect(insertedGemsFromContract[0].toNumber()).to.be.equal(
        gemTokenIds[0]
      );
      expect(insertedGemsFromContract[1].toNumber()).to.be.equal(
        gemTokenIds[1]
      );

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenIds[2],
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: item has no free slots');

      for (let i = 0; i < insertedGemsFromContract.length; i++) {
        const insertedGemFromContract = await gemRegistry.insertedGem(
          tokenId,
          i
        );
        expect(insertedGemFromContract.toNumber()).to.be.equal(
          insertedGemsFromContract[i]
        );
      }
    });
    it('should revert if slots = 0', async () => {
      const gemItemType = 1;
      const type = 4;
      const item = itemTypeItemsMap[type][0]; // has 0 slots
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: item has no free slots');
    });
    it('should revert if not caller does not own the token', async () => {
      const gemItemType = 2;
      const type = 9;
      const item = itemTypeItemsMap[type][0]; // has 0 slots
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await inGameItemsUser.transferFrom(
        user.address,
        deployer.address,
        tokenId
      );

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: caller is not owner of token');
    });
    it('should revert if caller does not own the gemToken', async () => {
      const gemItemType = 2;
      const type = 9;
      const item = itemTypeItemsMap[type][0]; // has 0 slots
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await inGameItemsUser.transferFrom(
        user.address,
        deployer.address,
        gemTokenId
      );

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: caller is not owner of gem token');
    });
    it('should revert if tokenId is not in item series', async () => {
      const gemItemType = 2;
      const type = 9;
      const otherType = 10;
      const item = itemTypeItemsMap[type][0];
      const otherItem = itemTypeItemsMap[otherType][0];
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          otherItem.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: tokenId is not in item series');
    });
    it('should revert if gemTokenId is not in gem item series', async () => {
      const gemItemType = 2;
      const otherGemItemType = 3;
      const type = 9;
      const item = itemTypeItemsMap[type][0];
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const otherGemItem = itemTypeItemsMap[otherGemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          otherGemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: gemTokenId is not in gem item series');
    });
    it('should revert if gem is not compatible with item', async () => {
      const gemItemType = 1;
      const type = 11;
      const item = itemTypeItemsMap[type][0];
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('GemRegistry: gem is not compatible with item');
    });
    it('should revert if paused', async () => {
      const gemItemType = 2;
      const type = 9;
      const item = itemTypeItemsMap[type][0]; // has 0 slots
      const itemSeries = await inGameItems.getItemSeries(item.itemId, 0);
      const tokenId = itemSeries.startingTokenId.toNumber();
      const gemItem = itemTypeItemsMap[gemItemType][0];
      const gemItemSeries = await inGameItems.getItemSeries(gemItem.itemId, 0);
      const gemTokenId = gemItemSeries.startingTokenId.toNumber();

      await gemRegistryPauser.pause();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.be.revertedWith('Pausable: paused');

      await gemRegistryPauser.unpause();

      await expect(
        gemRegistryUser.insertGem(
          tokenId,
          item.itemId,
          0,
          gemTokenId,
          gemItem.itemId,
          0
        )
      ).to.not.be.reverted;
    });
  });
  describe('pause', () => {
    it('should revert if not called by pauser', async () => {
      await expect(gemRegistryUser.pause()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
      await expect(gemRegistryUser.unpause()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });
  });
  describe('setTrustedForwarder', () => {
    it('should set trustedForwarder', async () => {
      const trustedForwarder = await gemRegistry.getTrustedForwarder();
      expect(trustedForwarder).to.equal(NULL_ADDRESS);
      await gemRegistryAdmin.setTrustedForwarder(deployer.address);
      expect(await gemRegistry.getTrustedForwarder()).to.equal(
        deployer.address
      );
    });
    it('should revert if not called by admin', async () => {
      await expect(
        gemRegistryUser.setTrustedForwarder(deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });
  describe('setInGameItems', () => {
    it('should set inGameItems', async () => {
      const inGameItemsAddress = await gemRegistry.inGameItems();
      expect(inGameItemsAddress).to.equal(inGameItems.address);
      await gemRegistryAdmin.setInGameItems(deployer.address);
      expect(await gemRegistry.inGameItems()).to.equal(deployer.address);
    });
    it('should revert if not called by admin', async () => {
      await expect(
        gemRegistryUser.setInGameItems(deployer.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });
  });
});
