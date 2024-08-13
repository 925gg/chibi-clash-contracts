import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployClashToken } from "../utils/deploy-clash-token";
import vestingSchedulesTest from "../data/vesting-schedules/vesting-schedules-test.json";
import vestingSchedules from "../data/vesting-schedules/vesting-schedules.json";
import { execute } from "../utils/execute";
import dayjs from "dayjs";
import { createNewTestWallet } from "../utils/create-new-test-wallet";
import { VestingSchedule } from "../scripts/vesting-schedules-set-up";
import { deployVestingSchedules } from "../utils/deploy-vesting-schedules";
import { assignVestingScheduleMembers } from "../utils/assign-vesting-schedule-members";

const schedules: VestingSchedule[] = vestingSchedulesTest.map((s) => ({
  ...s,
  members: s.members.filter((m) => m.address),
})) as any;

describe("Vesting", function () {
  const tgeTimestamp = dayjs().unix();
  async function deployFixture() {
    const [publisher] = await ethers.getSigners();

    const clashContract = await deployClashToken(publisher);
    process.env.BASE_CLASH_TOKEN_ADDRESS = await clashContract.getAddress();

    const vestingContract = await ethers.deployContract(
      "Vesting",
      [await clashContract.getAddress(), tgeTimestamp, "Team"],
      publisher,
    );
    await vestingContract.waitForDeployment();

    return {
      clashContract,
      vestingContract,
      admin: publisher,
    };
  }

  describe("deploy", function () {
    it("should deploy successfully", async function () {
      const { vestingContract, clashContract } =
        await loadFixture(deployFixture);

      expect(await vestingContract.vestingName()).to.equal("Team");
      expect(await vestingContract.start()).to.equal(tgeTimestamp);
      expect(await vestingContract.token()).to.equal(
        await clashContract.getAddress(),
      );
    });

    it("should run production configurations successfully", async function () {
      const { admin } = await loadFixture(deployFixture);
      const prodSchedules = vestingSchedules as unknown as VestingSchedule[];
      await deployVestingSchedules(admin, prodSchedules, async () => {
        // do nothing
      });
      console.log("assignVestingScheduleMembers");
      await assignVestingScheduleMembers(admin, prodSchedules, async () => {
        // do nothing
      });
    });
  });

  describe("addUnlockEvents", function () {
    it("should add unlock events successfully", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);

      const unlockPercentX100 = [100, 100, 100, 700];
      const unlockTime = [
        tgeTimestamp,
        dayjs.unix(tgeTimestamp).add(1, "month").unix(),
        dayjs.unix(tgeTimestamp).add(2, "month").unix(),
        dayjs.unix(tgeTimestamp).add(3, "month").unix(),
      ];
      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(unlockPercentX100, unlockTime);

      const unlockEvents = await vestingContract.getUnlockEvents();
      expect(unlockEvents.length).to.equal(unlockPercentX100.length);
      for (let i = 0; i < unlockEvents.length; i++) {
        expect(unlockEvents[i].percentX100).to.equal(unlockPercentX100[i]);
        expect(unlockEvents[i].unlockTime).to.equal(unlockTime[i]);
      }
    });

    it("should revert if params are invalid", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);

      await expect(
        execute(vestingContract)
          .by(admin)
          .addUnlockEvents(
            [...schedules[0].unlockEvents.map((e) => e.percentX100), 100],
            schedules[0].unlockEvents.map((e) => e.unlockTime),
          ),
      ).to.be.revertedWith("Invalid params");
    });

    it("should revert if unlock time doesn't start from TGE", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const tgeTime = dayjs.unix(tgeTimestamp);

      await expect(
        execute(vestingContract)
          .by(admin)
          .addUnlockEvents([tgeTime.add(-1, "day").unix()], [400]),
      ).to.be.revertedWith("Unlock time must start from TGE");
    });

    it("should revert if unlock time isn't in order", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const tgeTime = dayjs.unix(tgeTimestamp);

      await expect(
        execute(vestingContract)
          .by(admin)
          .addUnlockEvents(
            [400, 600],
            [tgeTime.unix(), tgeTime.add(-1, "day").unix()],
          ),
      ).to.be.revertedWith("Unlock time has to be in order");
    });

    it("should revert if unlock time isn't in order when adding additional events", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const tgeTime = dayjs.unix(tgeTimestamp);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 600],
          [tgeTime.unix(), tgeTime.add(2, "day").unix()],
        );

      await expect(
        execute(vestingContract)
          .by(admin)
          .addUnlockEvents([tgeTime.add(-1, "day").unix()], [600]),
      ).to.be.revertedWith("Unlock time has to be in order");
    });

    it("should revert if total percentageX100 is greater than 10000", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const tgeTime = dayjs.unix(tgeTimestamp);

      await expect(
        execute(vestingContract)
          .by(admin)
          .addUnlockEvents(
            [2000, 9000],
            [tgeTime.unix(), tgeTime.add(2, "day").unix()],
          ),
      ).to.be.revertedWith("Invalid percent values");
    });

    it("should revert if called by an authorized user", async function () {
      const { vestingContract } = await loadFixture(deployFixture);
      const unauthorized = await createNewTestWallet();

      await expect(
        execute(vestingContract)
          .by(unauthorized)
          .addUnlockEvents(
            schedules[0].unlockEvents.map((e) => e.percentX100),
            schedules[0].unlockEvents.map((e) => e.unlockTime),
          ),
      ).to.be.revertedWithCustomError(
        vestingContract,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("getUnlockEvents", function () {
    it("should get unlock events successfully", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);

      const unlockPercentX100 = [100, 100, 100, 700];
      const unlockTime = [
        tgeTimestamp,
        dayjs.unix(tgeTimestamp).add(1, "month").unix(),
        dayjs.unix(tgeTimestamp).add(2, "month").unix(),
        dayjs.unix(tgeTimestamp).add(3, "month").unix(),
      ];
      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(unlockPercentX100, unlockTime);

      const unlockEvents = await vestingContract.getUnlockEvents();
      expect(unlockEvents.length).to.equal(unlockPercentX100.length);
      for (let i = 0; i < unlockEvents.length; i++) {
        expect(unlockEvents[i].percentX100).to.equal(unlockPercentX100[i]);
        expect(unlockEvents[i].unlockTime).to.equal(unlockTime[i]);
      }
    });
  });

  describe("addBeneficiaries", function () {
    it("should add beneficiaries successfully", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      const unlockPercentX100 = [100, 100, 100, 700];
      const unlockTime = [
        tgeTimestamp,
        dayjs.unix(tgeTimestamp).add(1, "month").unix(),
        dayjs.unix(tgeTimestamp).add(2, "month").unix(),
        dayjs.unix(tgeTimestamp).add(3, "month").unix(),
      ];
      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(unlockPercentX100, unlockTime);

      const schedule = schedules.find((s) => s.name === "Team")!;
      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther(schedule.tokensAllocated.toString()),
        );

      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries(
          schedule.members.map((m) => m.address),
          schedule.members.map(
            (m) => BigInt(m.tokensAllocated) * ethers.parseEther("1"),
          ),
        );

      const beneficiaries = await vestingContract.getBeneficiaries();

      for (let i = 0; i < schedule.members.length; i++) {
        expect(beneficiaries[i]).to.equal(schedule.members[i].address);
        const amount = await vestingContract.tokenAmounts(beneficiaries[i]);
        expect(amount).to.equal(
          BigInt(schedule.members[i].tokensAllocated) * ethers.parseEther("1"),
        );
      }
    });

    it("should revert if params are invalid", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const schedule = schedules.find((s) => s.name === "Team")!;

      await expect(
        execute(vestingContract)
          .by(admin)
          .addBeneficiaries(
            schedule.members.map((m) => m.address),
            [
              ...schedule.members.map(
                (m) => BigInt(m.tokensAllocated) * ethers.parseEther("1"),
              ),
              100,
            ],
          ),
      ).to.be.revertedWith("Invalid params");
    });

    it("should revert if the contract does not have enough token", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);
      const schedule = schedules.find((s) => s.name === "Team")!;

      await expect(
        execute(vestingContract)
          .by(admin)
          .addBeneficiaries(
            schedule.members.map((m) => m.address),
            schedule.members.map(
              (m) => BigInt(m.tokensAllocated) * ethers.parseEther("1"),
            ),
          ),
      ).to.be.revertedWith("Not enough token to cover");
    });

    it("should revert if the beneficiary is address(0)", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(clashContract)
        .by(admin)
        .transfer(await vestingContract.getAddress(), ethers.parseEther("100"));

      await expect(
        execute(vestingContract)
          .by(admin)
          .addBeneficiaries(
            ["0x0000000000000000000000000000000000000000"],
            [100],
          ),
      ).to.be.revertedWith("The beneficiary's address cannot be 0");
    });

    it("should revert if the amount is 0", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);

      await expect(
        execute(vestingContract)
          .by(admin)
          .addBeneficiaries([admin.address], [0]),
      ).to.be.revertedWith("Amount has to be greater than 0");
    });

    it("should revert if called by an authorized user", async function () {
      const { vestingContract } = await loadFixture(deployFixture);
      const schedule = schedules.find((s) => s.name === "Team")!;
      const unauthorized = await createNewTestWallet();

      await expect(
        execute(vestingContract)
          .by(unauthorized)
          .addBeneficiaries(
            schedule.members.map((m) => m.address),
            schedule.members.map(
              (m) => BigInt(m.tokensAllocated) * ethers.parseEther("1"),
            ),
          ),
      ).to.be.revertedWithCustomError(
        vestingContract,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("getUnlockEvents", function () {
    it("should get unlock events successfully", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      const schedule = schedules.find((s) => s.name === "Team")!;
      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther(schedule.tokensAllocated.toString()),
        );

      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries(
          schedule.members.map((m) => m.address),
          schedule.members.map(
            (m) => BigInt(m.tokensAllocated) * ethers.parseEther("1"),
          ),
        );

      const beneficiaries = await vestingContract.getBeneficiaries();
      for (let i = 0; i < schedule.members.length; i++) {
        expect(beneficiaries[i]).to.equal(schedule.members[i].address);
        const amount = await vestingContract.tokenAmounts(beneficiaries[i]);
        expect(amount).to.equal(
          BigInt(schedule.members[i].tokensAllocated) * ethers.parseEther("1"),
        );
      }
    });
  });

  describe("claimTokens", function () {
    it("should claim tokens successfully", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther("1000"),
        );

      const user = await createNewTestWallet();
      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries([user.address], [ethers.parseEther("1000")]);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 1000, 1000, 7600],
          [
            tgeTimestamp,
            dayjs.unix(tgeTimestamp).add(1, "month").unix(),
            dayjs.unix(tgeTimestamp).add(2, "month").unix(),
            dayjs.unix(tgeTimestamp).add(3, "month").unix(),
          ],
        );

      expect(await clashContract.balanceOf(user.address)).to.equal(0);
      expect(await vestingContract.tokenAmounts(user.address)).to.equal(
        ethers.parseEther("1000"),
      );

      await execute(vestingContract).by(user).claimTokens();
      expect(
        await vestingContract.releasedAmount(user.address),
      ).to.greaterThanOrEqual(ethers.parseEther("40"));
      expect(await clashContract.balanceOf(user.address)).to.greaterThanOrEqual(
        ethers.parseEther("40"),
      );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(1, "month").unix());
      await execute(vestingContract).by(user).claimTokens();
      expect(await vestingContract.releasedAmount(user.address)).to.equal(
        ethers.parseEther("140"),
      );
      expect(await clashContract.balanceOf(user.address)).to.equal(
        ethers.parseEther("140"),
      );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(2, "month").unix());
      await execute(vestingContract).by(user).claimTokens();
      expect(await vestingContract.releasedAmount(user.address)).to.equal(
        ethers.parseEther("240"),
      );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(3, "month").unix());
      await execute(vestingContract).by(user).claimTokens();
      expect(await vestingContract.releasedAmount(user.address)).to.equal(
        ethers.parseEther("1000"),
      );
      expect(await clashContract.balanceOf(user.address)).to.equal(
        ethers.parseEther("1000"),
      );

      await expect(
        execute(vestingContract).by(user).claimTokens(),
      ).to.be.revertedWith("User already released all available tokens");
    });

    it("should revert if there are no tokens to claim", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther("1000"),
        );

      const user = await createNewTestWallet();
      await expect(
        execute(vestingContract).by(user).claimTokens(),
      ).to.be.revertedWith("No tokens to claim");
    });

    it("should revert if the user has already released all available tokens", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther("1000"),
        );

      const user = await createNewTestWallet();
      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries([user.address], [ethers.parseEther("1000")]);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 1000, 1000, 7600],
          [
            tgeTimestamp,
            dayjs.unix(tgeTimestamp).add(1, "month").unix(),
            dayjs.unix(tgeTimestamp).add(2, "month").unix(),
            dayjs.unix(tgeTimestamp).add(3, "month").unix(),
          ],
        );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(3, "month").unix());
      await execute(vestingContract).by(user).claimTokens();

      await expect(
        execute(vestingContract).by(user).claimTokens(),
      ).to.be.revertedWith("User already released all available tokens");
    });
  });

  describe("claimablePercent", function () {
    it("should get claimable percent successfully", async function () {
      const { vestingContract, admin } = await loadFixture(deployFixture);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 1000, 1000, 7600],
          [
            tgeTimestamp,
            dayjs.unix(tgeTimestamp).add(1, "month").unix(),
            dayjs.unix(tgeTimestamp).add(2, "month").unix(),
            dayjs.unix(tgeTimestamp).add(3, "month").unix(),
          ],
        );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(1, "month").unix());
      expect(await vestingContract.claimablePercent()).to.equal(1400);

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(2, "month").unix());
      expect(await vestingContract.claimablePercent()).to.equal(2400);
    });

    it("should get 0 percent before tge", async function () {
      const { clashContract, admin } = await loadFixture(deployFixture);
      const vestingContract = await ethers.deployContract(
        "Vesting",
        [
          await clashContract.getAddress(),
          dayjs.unix(tgeTimestamp).add(1, "month").unix(),
          "Team",
        ],
        admin,
      );
      await vestingContract.waitForDeployment();
      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 1000, 1000, 7600],
          [
            dayjs.unix(tgeTimestamp).add(1, "month").unix(),
            dayjs.unix(tgeTimestamp).add(2, "month").unix(),
            dayjs.unix(tgeTimestamp).add(3, "month").unix(),
            dayjs.unix(tgeTimestamp).add(4, "month").unix(),
          ],
        );

      expect(await vestingContract.claimablePercent()).to.equal(0);
    });
  });

  describe("claimableAmount", function () {
    it("should get claimable amount successfully", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther("1000"),
        );

      const user = await createNewTestWallet();
      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries([user.address], [ethers.parseEther("1000")]);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [400, 1000, 1000, 7600],
          [
            tgeTimestamp,
            dayjs.unix(tgeTimestamp).add(1, "month").unix(),
            dayjs.unix(tgeTimestamp).add(2, "month").unix(),
            dayjs.unix(tgeTimestamp).add(3, "month").unix(),
          ],
        );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(1, "month").unix());
      expect(await vestingContract.claimableAmount(user.address)).to.equal(
        ethers.parseEther("140"),
      );

      await time.increaseTo(dayjs.unix(tgeTimestamp).add(2, "month").unix());
      expect(await vestingContract.claimableAmount(user.address)).to.equal(
        ethers.parseEther("240"),
      );
    });
  });

  describe("withdrawAllERC20", function () {
    it("should claim tokens successfully", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      const treasury = await createNewTestWallet();

      await execute(clashContract)
        .by(admin)
        .transfer(
          await vestingContract.getAddress(),
          ethers.parseEther("1000"),
        );
      await execute(clashContract)
        .by(admin)
        .transfer(treasury.address, ethers.parseEther("4999999000"));
      expect(await clashContract.balanceOf(admin.address)).to.equal(0);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents([10000], [tgeTimestamp]);

      const user = await createNewTestWallet();
      await execute(vestingContract)
        .by(admin)
        .addBeneficiaries([user.address], [ethers.parseEther("900")]);

      await time.increase(24 * 60 * 60 * 100);

      await execute(vestingContract)
        .by(admin)
        .withdrawAllERC20(await clashContract.getAddress());

      expect(await clashContract.balanceOf(admin.address)).to.equal(
        ethers.parseEther("100"),
      );
    });

    it("should revert if vesting period has not ended yet", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [1000, 9000],
          [tgeTimestamp, dayjs.unix(tgeTimestamp).add(1, "month").unix()],
        );

      await expect(
        execute(vestingContract)
          .by(admin)
          .withdrawAllERC20(await clashContract.getAddress()),
      ).to.be.revertedWith("Vesting period not ended");
    });

    it("should revert if no tokens to withdraw", async function () {
      const { clashContract, vestingContract, admin } =
        await loadFixture(deployFixture);

      await execute(vestingContract)
        .by(admin)
        .addUnlockEvents(
          [1000, 9000],
          [tgeTimestamp, dayjs.unix(tgeTimestamp).add(1, "day").unix()],
        );

      await time.increase(24 * 60 * 60 * 100);

      await expect(
        execute(vestingContract)
          .by(admin)
          .withdrawAllERC20(await clashContract.getAddress()),
      ).to.be.revertedWith("No tokens to withdraw");
    });

    it("should revert if called by an authorized user", async function () {
      const { clashContract, vestingContract } =
        await loadFixture(deployFixture);
      const unauthorized = await createNewTestWallet();

      await expect(
        execute(vestingContract)
          .by(unauthorized)
          .withdrawAllERC20(await clashContract.getAddress()),
      ).to.be.revertedWithCustomError(
        vestingContract,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
