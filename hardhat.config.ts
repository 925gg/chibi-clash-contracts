import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-web3";
import "@openzeppelin/hardhat-upgrades";
import { config as dotEnvConfig } from "dotenv";
import "hardhat-gas-reporter";

dotEnvConfig();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    hardhat: {},
  },
  etherscan: {
    apiKey: {},
    customChains: [],
  },
};

export default config;
