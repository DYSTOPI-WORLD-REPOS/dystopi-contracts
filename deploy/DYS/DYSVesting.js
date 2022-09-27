const contractName = 'DYSVesting';

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();
  const dysToken = await deployments.get('DYSToken');
  await deploy(contractName, {
    from: deployer,
    args: [
      dysToken.address
    ],
    log: true,
    skipIfAlreadyDeployed: true
  });
};

module.exports.tags = [contractName];
