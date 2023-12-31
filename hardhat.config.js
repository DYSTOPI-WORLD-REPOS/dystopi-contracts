require('dotenv').config();
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');
require('hardhat-deploy');
require('@nomiclabs/hardhat-waffle');
require('solidity-coverage');
require('@openzeppelin/hardhat-upgrades');
require('@nomicfoundation/hardhat-chai-matchers');

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
      accounts: [process.env.POLYGON_DEPLOYER],
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY
        }
      }
    },
    polygonMumbai: {
      url: process.env.MUMBAI_URL,
      accounts: [process.env.MUMBAI_DEPLOYER],
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY
        }
      }
    },
    bsc: {
      url: process.env.BSC_URL,
      accounts: [process.env.BSC_DEPLOYER],
      verify: {
        etherscan: {
          apiKey: process.env.BSCSCAN_API_KEY
        }
      }
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
    upgradeAdmin: {
      polygonMumbai: 0,
      hardhat: 0
    },
    dysBeneficiary: {
      hardhat: 0,
      mainnet: '0x9Cc9F2a6C035Ce0d3Dc37013516f03cbe2127565',
      bsc: '0x1315AbD49D4A978749a9d9DA3cD54C319E7b5b10'
    },
    marketplaceBeneficiary: {
      polygonMumbai: 0,
      hardhat: 0
    },
    marketplaceSigner: {
      polygonMumbai: '0xd8288Ce8348D53887Cb934240B93F5B41B08D4BE',
      hardhat: '0xd8288Ce8348D53887Cb934240B93F5B41B08D4BE'
    },
    pancakeRouter: {
      bsc: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
    },
    admin: {
      polygonMumbai: 0,
      hardhat: 0,
      bsc: '0x995Cf311dB5E0E45b7C3aE23ed62FB0237eEFABC'
    },
    pauser: {
      polygonMumbai: 0,
      hardhat: 0
    },
    minter: {
      polygonMumbai: 0,
      hardhat: 0
    },
    itemAdmin: {
      polygonMumbai: 0,
      hardhat: 0
    },
    storeAdmin: {
      polygonMumbai: 0,
      hardhat: 0
    },
    dysChildPolygon: {
      polygon: '0xEe3f542eA3dAf6fcD901911C4e6a359EF126b54a',
      polygonMumbai: '0x4EA658c98cfa7446deb80B3d03713321c6D1A6b4'
    },
    nullAddress: {
      default: '0x0000000000000000000000000000000000000000'
    }
  },
  gasReporter: {
    enabled: true
  }
  // etherscan: {
  //   apiKey: {
  //     mainnet: process.env.ETHERSCAN_API_KEY,
  //     goerli: process.env.ETHERSCAN_API_KEY,
  //     polygon: process.env.POLYGONSCAN_API_KEY,
  //     polygonMumbai: process.env.POLYGONSCAN_API_KEY
  //   }
  // }
};
