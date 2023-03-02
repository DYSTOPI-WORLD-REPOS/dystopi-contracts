const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer, dysBeneficiary } = await getNamedAccounts();

  await deploy(CONTRACTS.dysToken, {
    from: deployer,
    args: [dysBeneficiary, 1_000_000_000],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [
  DEPLOY_TAGS.actions.deployDysToken,
  DEPLOY_TAGS.groups.token
];
