import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployClashToken } from "../utils/deploy-clash-token";

describe("ClashToken", function () {
  async function deployFixture() {
    const [publisher] = await ethers.getSigners();

    const clashContract = await deployClashToken(publisher);

    return {
      clashContract,
      admin: publisher,
    };
  }

  describe("deploy", function () {
    it("should deploy successfully", async function () {
      const { clashContract, admin } = await loadFixture(deployFixture);

      expect(await clashContract.name()).to.equal("Chibi Clash Token");
      expect(await clashContract.symbol()).to.equal("CLASH");
      expect(await clashContract.decimals()).to.equal(18);

      const treasuryBalance = await clashContract.balanceOf(admin.address);
      expect(treasuryBalance).to.equal(ethers.parseEther("5000000000"));

      const totalSupply = await clashContract.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther("5000000000"));
    });
  });
});
