const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;

  const chainId = await getChainId();

  const { deployer, dysChildPolygon } = await getNamedAccounts();

  // use child token on polygon
  let tokenAddress = dysChildPolygon;
  if (chainId !== '137') {
    const dysToken = await deployments.get(CONTRACTS.dysToken);
    tokenAddress = dysToken.address;
  }

  await deploy(CONTRACTS.dysVesting, {
    from: deployer,
    args: [tokenAddress],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [
  DEPLOY_TAGS.actions.deployDysVesting,
  DEPLOY_TAGS.vesting
];
