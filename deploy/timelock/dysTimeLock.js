const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  if (!admin || !deployer) {
    throw new Error(
      `Missing one or more roles: admin: ${admin}, deployer: ${deployer}`
    );
  }

  await deploy(CONTRACTS.dysTimeLock, {
    from: deployer,
    args: [[admin], [admin]],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [DEPLOY_TAGS.actions.deployDysTimeLock];
