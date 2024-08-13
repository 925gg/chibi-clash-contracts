import { ethers, run } from "hardhat";
import { Signer } from "ethers";
import { logger } from "./logger";

export const deployClashToken = async (publisher: Signer) => {
  const publisherAddress = await publisher.getAddress();
  const clashTokenContract = await ethers.deployContract(
    "ClashToken",
    [publisherAddress],
    publisher,
  );
  await clashTokenContract.waitForDeployment();
  logger.info(`ClashToken deployed to ${clashTokenContract.target}.`);

  if (process.env.VERIFY_CONTRACT === "true") {
    await run(`verify:verify`, {
      address: clashTokenContract.target,
      constructorArguments: [publisherAddress],
    });
    logger.info("ClashToken contract verified.");
  }

  return clashTokenContract;
};
