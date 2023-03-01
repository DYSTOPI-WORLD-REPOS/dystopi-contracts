const { DEPLOY_TAGS } = require('../../utils/constants');
const contractName = DEPLOY_TAGS.contracts.inGameItemMarketplace;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const inGameItems = await deployments.get('InGameItems');

  const {
    deployer,
    admin,
    pauser,
    storeAdmin,
    marketplaceBeneficiary,
    marketplaceSigner,
    nullAddress
  } = await getNamedAccounts();

  await deploy(contractName, {
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

module.exports.tags = [contractName, DEPLOY_TAGS.marketplace];
module.exports.dependencies = [DEPLOY_TAGS.items];
