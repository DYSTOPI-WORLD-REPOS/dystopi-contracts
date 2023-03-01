const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const inGameItems = await deployments.get(CONTRACTS.inGameItems);

  const {
    deployer,
    admin,
    pauser,
    storeAdmin,
    marketplaceBeneficiary,
    marketplaceSigner,
    nullAddress
  } = await getNamedAccounts();

  await deploy(CONTRACTS.inGameItemMarketplace, {
    from: deployer,
    args: [
      admin,
      pauser,
      storeAdmin,
      marketplaceBeneficiary,
      marketplaceSigner,
      inGameItems.address,
      nullAddress
    ],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [
  DEPLOY_TAGS.actions.deployInGameItemMarketplace,
  DEPLOY_TAGS.marketplace
];
module.exports.dependencies = [DEPLOY_TAGS.items];
