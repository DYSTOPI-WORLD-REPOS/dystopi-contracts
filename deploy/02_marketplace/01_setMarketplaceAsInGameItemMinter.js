const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, execute, read } = deployments;

  const { admin } = await getNamedAccounts();

  const marketplace = await deployments.get(CONTRACTS.inGameItemMarketplace);

  const minterRole = await read(CONTRACTS.inGameItems, 'MINTER_ROLE');

  const isMinter = await read(
    CONTRACTS.inGameItems,
    'hasRole',
    minterRole,
    marketplace.address
  );

  if (!isMinter) {
    log(
      `Adding ${CONTRACTS.inGameItemMarketplace} as a minter on ${CONTRACTS.inGameItems}`
    );
    await execute(
      CONTRACTS.inGameItems,
      { from: admin, log: true },
      'grantRole',
      minterRole,
      marketplace.address
    );
  }
};

module.exports.tags = [
  DEPLOY_TAGS.actions.setMarketplaceAsInGameItemMinter,
  DEPLOY_TAGS.groups.marketplace
];
module.exports.dependencies = [DEPLOY_TAGS.actions.deployInGameItemMarketplace];
