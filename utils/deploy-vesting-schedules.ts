/* eslint-disable camelcase */
import { Signer } from "ethers";
import { ethers, run } from "hardhat";
import {
  ClashToken__factory,
  Vesting,
  Vesting__factory,
} from "../typechain-types";
import { execute } from "./execute";
import vestingSchedulesConfiguration from "../data/vesting-schedules/vesting-schedules-configuration.json";
import { logger } from "./logger";
import { VestingSchedule } from "../scripts/vesting-schedules-set-up";
import dayjs from "dayjs";

const numberFormat = new Intl.NumberFormat("en-US");

export const deployVestingSchedules = async (
  publisher: Signer,
  vestingSchedules: VestingSchedule[],
  updateVestingSchedules: (
    vestingSchedules: VestingSchedule[],
  ) => Promise<void>,
) => {
  const clashAddress = process.env.BASE_CLASH_TOKEN_ADDRESS as string;
  if (!clashAddress) {
    throw Error("Clash address is not set");
  }
  if (!vestingSchedulesConfiguration.tgeTimestamp) {
    throw Error("TGE timestamp is not set");
  }
  const clashContract = ClashToken__factory.connect(clashAddress, publisher);
  const vestingScheduleContracts: Vesting[] = [];
  for (const vestingSchedule of vestingSchedules) {
    let vestingContract: Vesting;
    if (vestingSchedule.contractAddress) {
      vestingContract = Vesting__factory.connect(
        vestingSchedule.contractAddress,
        publisher,
      );
      logger.info(
        `Vesting contract for ${vestingSchedule.name} already deployed to ${await vestingContract.getAddress()}.`,
      );
    } else {
      const startTime = dayjs
        .unix(vestingSchedulesConfiguration.tgeTimestamp)
        .add(-vestingSchedule.daysBeforeTge, "day")
        .unix();
      vestingContract = await ethers.deployContract(
        "Vesting",
        [clashAddress, startTime, vestingSchedule.name],
        publisher,
      );
      await vestingContract.waitForDeployment();
      logger.info(
        `Vesting contract for ${vestingSchedule.name} deployed to ${vestingContract.target}.
    Start time: ${startTime}.
    Clash address: ${clashAddress}.`,
      );
      vestingSchedule.contractAddress = vestingContract.target as string;
      await updateVestingSchedules(vestingSchedules);
      logger.info(`Updated vesting schedules`);

      if (process.env.VERIFY_CONTRACT === "true") {
        await run(`verify:verify`, {
          address: vestingContract.target,
          constructorArguments: [clashAddress, startTime, vestingSchedule.name],
        })
          .then(() => {
            logger.info("Vesting schedule contract verified.");
          })
          .catch((_error) => {
            logger.error("Vesting schedule contract verification failed");
          });
      }
    }
    vestingScheduleContracts.push(vestingContract);

    const events = await vestingContract.getUnlockEvents();
    if (events.length > 0) {
      console.log(
        "Skip adding unlock events to vesting schedule. Unlock events already added",
      );
    } else {
      const addUnlockEventsTx = await vestingContract.addUnlockEvents(
        vestingSchedule.unlockEvents.map((u) => u.percentX100),
        vestingSchedule.unlockEvents.map((u) => u.unlockTime),
      );
      await addUnlockEventsTx.wait();
      logger.info(`Unlock Events added`);
    }

    const balance = await clashContract.balanceOf(vestingContract.target);
    if (balance > 0) {
      console.log(
        "Skip transferring $CLASH to vesting schedule. BBalance is not 0",
      );
    } else {
      const transferClashTx = await execute(clashContract)
        .by(publisher)
        .transfer(
          vestingContract.target,
          ethers.parseEther(vestingSchedule.tokensAllocated.toString()),
        );
      await transferClashTx.wait();
      logger.info(
        `Transferred ${numberFormat.format(vestingSchedule.tokensAllocated)} $CLASH to vesting schedule`,
      );
    }
  }
  return {
    vestingSchedules,
    vestingScheduleContracts,
  };
};
