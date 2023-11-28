const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer, dysBeneficiary, admin, pancakeRouter } =
    await getNamedAccounts();

  if (!pancakeRouter || !admin || !deployer || !dysBeneficiary) {
    throw new Error(
      `Missing one or more roles: pancakeRouter: ${pancakeRouter}, admin: ${admin}, deployer: ${deployer}, dysBeneficiary: ${dysBeneficiary}`
    );
  }

  const dysTimeLock = await deployments.get(CONTRACTS.dysTimeLock);

  await deploy(CONTRACTS.dysToken, {
    from: deployer,
    args: [
      dysTimeLock.address, // DEFAULT_ADMIN_ROLE - timelock
      admin, // PAUSER_ROLE - multisig
      dysTimeLock.address, // FEE_ADMIN_ROLE - timelock
      dysTimeLock.address, // TREASURER_ROLE - timelock
      pancakeRouter, // pancakeSwap router address
      dysBeneficiary, // initial beneficiary - multisig
      1_000_000_000 // initial supply
    ],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [
  DEPLOY_TAGS.actions.deployDysToken,
  DEPLOY_TAGS.groups.token
];

module.exports.dependencies = [DEPLOY_TAGS.actions.deployDysTimeLock];
