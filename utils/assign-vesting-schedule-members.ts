/* eslint-disable camelcase */
import { Signer } from "ethers";
import { Vesting__factory } from "../typechain-types";
import { execute } from "./execute";
import { logger } from "./logger";
import { VestingSchedule } from "../scripts/vesting-schedules-set-up";
import { ethers } from "hardhat";

export const assignVestingScheduleMembers = async (
  publisher: Signer,
  vestingSchedules: VestingSchedule[],
  updateVestingSchedules: (
    vestingSchedules: VestingSchedule[],
  ) => Promise<void>,
) => {
  for (const vestingSchedule of vestingSchedules) {
    const vestingContract = Vesting__factory.connect(
      vestingSchedule.contractAddress as string,
      publisher,
    );
    const hasAssigned = vestingSchedule.members.find(
      (member) => member.assigned,
    );
    if (hasAssigned) {
      logger.info(
        `Members already assigned to ${vestingSchedule.name} vesting schedule.`,
      );
      continue;
    }
    const availableMembers = vestingSchedule.members.filter(
      (member) => member.tokensAllocated > 0 && member.address,
    );
    availableMembers.forEach((member) => {
      member.assigned = true;
    });
    const tx = await execute(vestingContract)
      .by(publisher)
      .addBeneficiaries(
        availableMembers.map((member) => member.address),
        availableMembers.map(
          (member) => BigInt(member.tokensAllocated) * ethers.parseEther("1"),
        ),
      );
    await tx.wait();

    logger.info(
      `Members added to ${vestingSchedule.name} vesting schedule:${availableMembers
        .map((member) => `\n${member.name} (${member.address})`)
        .join(", ")}.`,
    );
    updateVestingSchedules(vestingSchedules);
  }
  return {
    vestingSchedules,
  };
};
