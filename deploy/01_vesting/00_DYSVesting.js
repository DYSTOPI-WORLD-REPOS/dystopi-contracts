const { DEPLOY_TAGS } = require('../../utils/constants');
const contractName = DEPLOY_TAGS.contracts.dysVesting;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const dysToken = await deployments.get('DYSToken');

  await deploy(contractName, {
    from: deployer,
    args: [dysToken.address],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [contractName, DEPLOY_TAGS.vesting];
module.exports.dependencies = [DEPLOY_TAGS.token];
