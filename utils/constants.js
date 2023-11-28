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
      vest: 'vest',
      _testItems: '_testItems'
    },
    actions: {
      // deploy
      deployDysToken: 'deployDysToken',
      deployDysTimeLock: 'deployDysTimeLock',
      deployDysVesting: 'deployDYSVesting',
      deployInGameItems: 'deployInGameItems',
      deployInGameItemMarketplace: 'deployInGameItemMarketplace',
      deployInGameAssetMarketplace: 'deployInGameAssetMarketplace',
      // set
      setMarketplaceAsInGameItemMinter: 'setMarketplaceAsInGameItemMinter',
      setPrivateRoundVesting: 'setPrivateRoundVesting',
      _setTestItems: '_setTestItems',
      // execute
      executePrivateRoundVesting: 'executePrivateRoundVesting'
    }
  },
  CONTRACTS: {
    dysToken: 'DYSToken',
    dysTimeLock: 'DYSTimeLock',
    dysVesting: 'DYSVesting',
    inGameItems: 'InGameItems',
    inGameItemMarketplace: 'InGameItemMarketplace',
    inGameAssetMarketplace: 'InGameAssetMarketplace'
  }
};
