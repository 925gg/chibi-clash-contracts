import fs from "fs/promises";
import { loadEnv } from "../utils/load-env";
import { logger } from "../utils/logger";
import vestingSchedules from "../data/vesting-schedules/vesting-schedules.json";
import vestingSchedulesTest from "../data/vesting-schedules/vesting-schedules-test.json";
import { network } from "hardhat";
import { deployVestingSchedules } from "../utils/deploy-vesting-schedules";
import { VestingSchedule } from "./vesting-schedules-set-up";
import { getPublisherFoundation } from "../utils/get-publisher-foundation";

loadEnv();

const updateVestingSchedules = async (schedules: VestingSchedule[]) => {
  await fs.writeFile(
    network.name === "base-sepolia"
      ? "./data/vesting-schedules/vesting-schedules-test.json"
      : "./data/vesting-schedules/vesting-schedules.json",
    JSON.stringify(schedules),
    "utf-8",
  );
};

async function main() {
  const publisher = getPublisherFoundation();
  let schedules: VestingSchedule[] = [];
  if (network.name === "base-sepolia") {
    const result = await deployVestingSchedules(
      publisher,
      vestingSchedules as any,
      updateVestingSchedules,
    );
    schedules = result.vestingSchedules;
  } else {
    const result = await deployVestingSchedules(
      publisher,
      vestingSchedulesTest as any,
      updateVestingSchedules,
    );
    schedules = result.vestingSchedules;
  }

  logger.info(`Please update env`);
  logger.info(
    `BASE_VESTING_SCHEDULES=${schedules.map((s) => s.contractAddress).join(",")}`,
  );

  await updateVestingSchedules(schedules);
  logger.info(`Vesting schedules deployed`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
