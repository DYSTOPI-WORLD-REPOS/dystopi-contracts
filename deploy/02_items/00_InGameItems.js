const getDeployVar = require('../../utils/getDeployVar');
const { DEPLOY_TAGS } = require('../../utils/constants');
const contractName = DEPLOY_TAGS.contracts.inGameItems;

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = await getChainId();

  const baseURI = getDeployVar('metadataApiUrl', chainId);

  const { deploy } = deployments;

  const {
    deployer,
    upgradeAdmin,
    admin,
    pauser,
    minter,
    itemAdmin,
    nullAddress
  } = await getNamedAccounts();

  await deploy(contractName, {
    from: deployer,
    contract: contractName,
    proxy: {
      owner: upgradeAdmin,
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          'Dystopi: Equipment',
          'DYSEQ',
          admin,
          pauser,
          minter,
          itemAdmin,
          nullAddress,
          baseURI
        ]
      },
      upgradeIndex: 0
    },
    log: true
  });
};

module.exports.tags = [contractName, DEPLOY_TAGS.items];
