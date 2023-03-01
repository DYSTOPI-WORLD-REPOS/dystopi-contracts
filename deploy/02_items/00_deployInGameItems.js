const getDeployVar = require('../../utils/getDeployVar');
const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = await getChainId();

  const baseURI = getDeployVar('metadataApiUrl', chainId);
  const name = getDeployVar('inGameItemsName', chainId);
  const symbol = getDeployVar('inGameItemsSymbol', chainId);

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

  await deploy(CONTRACTS.inGameItems, {
    from: deployer,
    contract: CONTRACTS.inGameItems,
    proxy: {
      owner: upgradeAdmin,
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          name,
          symbol,
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

module.exports.tags = [
  DEPLOY_TAGS.actions.deployInGameItems,
  DEPLOY_TAGS.items
];
