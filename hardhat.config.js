require('dotenv').config();
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');
require('hardhat-deploy');
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    goerli: {
      url: process.env.GOERLI_URL,
      accounts: [process.env.GOERLI_DEPLOYER]
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: [process.env.MAINNET_DEPLOYER]
    },
    polygon: {
      url: process.env.POLYGON_URL,
      accounts: [process.env.POLYGON_DEPLOYER]
    },
    mumbai: {
      url: process.env.MUMBAI_URL,
      accounts: [process.env.MUMBAI_DEPLOYER]
    }
  },
  solidity: {
    version: '0.8.4',
    optimizer: true,
    runs: 100
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    dysBeneficiary: {
      default: '0xFe3AC01fA715A09721266B9db1F9f60d0BF1BDbB',
      hardhat: 0
    }
  },
  gasReporter: {
    enabled: true
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY
    }
  }
};
