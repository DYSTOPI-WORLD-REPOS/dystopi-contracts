const DEPLOY_VARS = require('./constants').DEPLOY_VARS;

const getDeployVar = (varName, chainId) => {
  const deployVar = DEPLOY_VARS[varName]
    ? DEPLOY_VARS[varName][chainId] || DEPLOY_VARS[varName].default
    : null;
  if (!deployVar) {
    throw new Error(
      `Deploy variable ${varName} not found for chainId ${chainId}`
    );
  }
  return deployVar;
};

module.exports = getDeployVar;
