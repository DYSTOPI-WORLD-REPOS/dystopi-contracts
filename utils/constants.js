module.exports = {
  DEPLOY_VARS: {
    metadataApiUrl: {
      80001: 'https://api-staging.dystopi.world/v1/items/token/metadata/',
      31337: 'https://api-staging.dystopi.world/v1/items/token/metadata/'
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
      token: 'token',
      vesting: 'vesting',
      items: 'items',
      marketplace: 'marketplace',
      vest: 'vest'
    },
    actions: {
      // deploy
      deployDysToken: 'deployDysToken',
      deployDysVesting: 'deployDYSVesting',
      deployInGameItems: 'deployInGameItems',
      deployInGameItemMarketplace: 'deployInGameItemMarketplace',
      deployInGameAssetMarketplace: 'deployInGameAssetMarketplace',
      // set
      setMarketplaceAsInGameItemMinter: 'setMarketplaceAsInGameItemMinter',
      setPrivateRoundVesting: 'setPrivateRoundVesting',
      // execute
      executePrivateRoundVesting: 'executePrivateRoundVesting'
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
