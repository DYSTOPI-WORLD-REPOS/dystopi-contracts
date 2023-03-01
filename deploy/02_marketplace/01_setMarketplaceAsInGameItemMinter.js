const { DEPLOY_TAGS } = require('../../utils/constants');
const actionName = DEPLOY_TAGS.actions.setMarketplaceAsInGameItemMinter;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, execute, read } = deployments;

  const { admin } = await getNamedAccounts();

  // add the marketplace to the items contract as a minter
  const marketplace = await deployments.get('InGameItemMarketplace');

  const minterRole = await read('InGameItems', 'MINTER_ROLE');

  const isMinter = await read(
    'InGameItems',
    'hasRole',
    minterRole,
    marketplace.address
  );

  if (!isMinter) {
    log(`Adding InGameItemMarketplace as a minter on InGameItems`);
    await execute(
      'InGameItems',
      { from: admin, log: true },
      'grantRole',
      minterRole,
      marketplace.address
    );
  }
};

module.exports.tags = [actionName, DEPLOY_TAGS.marketplace];
module.exports.dependencies = [DEPLOY_TAGS.contracts.inGameItemMarketplace];
