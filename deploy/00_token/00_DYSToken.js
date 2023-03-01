const { DEPLOY_TAGS } = require('../../utils/constants');
const contractName = DEPLOY_TAGS.contracts.dysToken;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer, dysBeneficiary } = await getNamedAccounts();

  await deploy(contractName, {
    from: deployer,
    args: [dysBeneficiary, 1_000_000_000],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [contractName, DEPLOY_TAGS.token];
