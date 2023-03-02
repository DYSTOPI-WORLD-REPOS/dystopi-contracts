const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const {
    deployer,
    admin,
    pauser,
    storeAdmin,
    marketplaceBeneficiary,
    marketplaceSigner,
    nullAddress
  } = await getNamedAccounts();

  await deploy(CONTRACTS.inGameAssetMarketplace, {
    from: deployer,
    args: [
      admin,
      pauser,
      storeAdmin,
      marketplaceBeneficiary,
      marketplaceSigner,
      nullAddress
    ],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [
  DEPLOY_TAGS.actions.deployInGameAssetMarketplace,
  DEPLOY_TAGS.groups.marketplace
];
