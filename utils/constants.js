module.exports = {
  DEPLOY_VARS: {
    metadataApiUrl: {
      80001: 'https://api-staging.dystopi.world/v1/items/token/metadata/',
      31337: ''
    },
    inGameItemsName: {
      default: 'Dystopi: Equipment'
    },
    inGameItemsSymbol: {
      default: 'DYSEQ'
    }
  },
  DEPLOY_TAGS: {
    groups: {
      token: 'TOKEN',
      vesting: 'VESTING',
      items: 'ITEMS',
      marketplace: 'MARKETPLACE'
    },
    actions: {
      // deploy
      deployDysToken: 'deployDysToken',
      deployDysVesting: 'deployDYSVesting',
      deployInGameItems: 'deployInGameItems',
      deployInGameItemMarketplace: 'deployInGameItemMarketplace',
      deployInGameAssetMarketplace: 'deployInGameAssetMarketplace',
      // set
      setMarketplaceAsInGameItemMinter: 'setMarketplaceAsInGameItemMinter'
    }
  },
  CONTRACTS: {
    dysToken: 'DYSToken',
    dysVesting: 'DYSVesting',
    inGameItems: 'InGameItems',
    inGameItemMarketplace: 'InGameItemMarketplace',
    inGameAssetMarketplace: 'InGameAssetMarketplace'
  }
};
