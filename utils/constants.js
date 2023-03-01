module.exports = {
  DEPLOY_VARS: {
    metadataApiUrl: {
      default: 'https://api-staging.dystopi.world/v1/items/token/metadata/'
    }
  },
  DEPLOY_TAGS: {
    groups: {
      token: 'TOKEN',
      vesting: 'VESTING',
      items: 'ITEMS',
      marketplace: 'MARKETPLACE'
    },
    contracts: {
      dysToken: 'DYSToken',
      dysVesting: 'DYSVesting',
      inGameItems: 'InGameItems',
      inGameItemMarketplace: 'InGameItemMarketplace'
    },
    actions: {
      setMarketplaceAsInGameItemMinter: 'setMarketplaceAsInGameItemMinter'
    }
  }
};
