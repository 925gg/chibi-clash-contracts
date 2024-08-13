import { loadEnv } from "../utils/load-env";
import { logger } from "../utils/logger";
import { deployClashToken } from "../utils/deploy-clash-token";
import { getPublisherFoundation } from "../utils/get-publisher-foundation";

loadEnv();

async function main() {
  const publisher = getPublisherFoundation();
  const clashTokenContract = await deployClashToken(publisher);

  logger.info(`Please update env`);
  logger.info(`BASE_CLASH_TOKEN_ADDRESS=${clashTokenContract.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
