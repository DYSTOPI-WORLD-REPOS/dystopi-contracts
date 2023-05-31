const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');
const fs = require('fs-extra');
const path = require('path');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, execute } = deployments;

  const { itemAdmin } = await getNamedAccounts();
  /*
  log('adding items to NFT contract');

  const itemsJSON = await fs.readJson(
    path.resolve(__dirname, './items/itemsForNFTContract.json')
  );

  await execute(
    CONTRACTS.inGameItems,
    { from: itemAdmin, log: true },
    'setupItems',
    itemsJSON
  );

  log('adding series to NFT contract');

  const seriesJSON = await fs.readJson(
    path.resolve(__dirname, './items/itemSeriesForNFTContract.json')
  );

  await execute(
    CONTRACTS.inGameItems,
    { from: itemAdmin, log: true },
    'setupItemSeries',
    seriesJSON
  );
*/
  log('adding series to marketplace contract');

  const seriesForMarketplaceJSON = await fs.readJson(
    path.resolve(__dirname, './items/itemSeriesForMarketplaceContract.json')
  );

  await execute(
    CONTRACTS.inGameItemMarketplace,
    { from: itemAdmin, log: true },
    'setupItemSeriesPricing',
    seriesForMarketplaceJSON
  );
};

module.exports.tags = [
  DEPLOY_TAGS.actions._setTestItems,
  DEPLOY_TAGS.groups._testItems
];

module.exports.dependencies = [
  DEPLOY_TAGS.groups.items,
  DEPLOY_TAGS.groups.marketplace
];

// only run on mumbai
module.exports.skip = async ({ getChainId }) => {
  return (await getChainId()) !== '80001';
};
