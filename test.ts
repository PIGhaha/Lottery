import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { getBigNumber, sleep } from "./utils";

describe("NudgePool", function () {
  before(async function () {
    const NPSwapAddress = "0x0aF4225CbEB3CCfF7EE8C607538f084F6f419B63";
    const NudgePoolAddress = "0x0a767FE847a41661BBecf419Bfa484cF185E729A";
    const NudgePoolStatusAddress = "0x81c9899AC82B807CF66D118AEC09e3dA97eccb9b";

    this.token1 = "0xe09D4de9f1dCC8A4d5fB19c30Fb53830F8e2a047";
    this.token2 = "0xDA2E05B28c42995D0FE8235861Da5124C1CE81Dd";
    this.dgt = "0xB6d7Bf947d4D6321FD863ACcD2C71f022BCFd0eE";

    this.signers = await ethers.getSigners();
    this.ipAccount1 = this.signers[1];
    this.ipAccount2 = this.signers[2];
    this.gpAccount1 = this.signers[3];
    this.gpAccount2 = this.signers[4];
    this.lpAccount1 = this.signers[5];
    this.lpAccount2 = this.signers[6];
    console.log("ipAccount1 address: " + this.ipAccount1.address);
    console.log("ipAccount2 address: " + this.ipAccount2.address);
    console.log("gpAccount1 address: " + this.gpAccount1.address);
    console.log("gpAccount2 address: " + this.gpAccount2.address);
    console.log("lpAccount1 address: " + this.lpAccount1.address);
    console.log("lpAccount2 address: " + this.lpAccount2.address);

    this.Token1 = await ethers.getContractAt('IERC20', this.token1);
    console.log("token1 address: " + this.Token1.address);
    this.Token2 = await ethers.getContractAt('IERC20', this.token2);
    console.log("token2 address: " + this.Token2.address);
    this.DGT = await ethers.getContractAt('IERC20', this.dgt);
    console.log("DGT address: " + this.DGT.address);

    this.NPSwap = await ethers.getContractAt('NPSwap', NPSwapAddress);
    console.log("NPSwap address: " + this.NPSwap.address);
    this.NudgePool = await ethers.getContractAt('NudgePool', NudgePoolAddress);
    console.log("NudgePool address: " + this.NudgePool.address);
    this.NudgePoolStatus = await ethers.getContractAt('NudgePoolStatus', NudgePoolStatusAddress);
    console.log("NudgePoolStatus address: " + this.NudgePoolStatus.address);
  })

  it("Change duration", async function () {
    this.auctionDuration = await this.NudgePool.auctionDuration();
    console.log("auctionDuration: " + this.auctionDuration);
    this.raisingDuration = await this.NudgePool.raisingDuration();
    console.log("raisingDuration: " + this.raisingDuration);
    this.minimumDuration = await this.NudgePool.minimumDuration();
    console.log("minimumDuration: " + this.minimumDuration);

    const setDurationTx = await this.NudgePool.setDuration(180,180,360);
    await setDurationTx.wait();

    expect(await this.NudgePool.auctionDuration()).to.be.equal(180);
    expect(await this.NudgePool.raisingDuration()).to.be.equal(180);
    expect(await this.NudgePool.minimumDuration()).to.be.equal(360);
  })

  it("Create pool", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage

    if (stage != 0) {
      return
    }

    await this.Token1.connect(this.ipAccount1).approve(this.NudgePool.address, getBigNumber(10000));

    const createTX  = await this.NudgePool.connect(this.ipAccount1).createPool(
      this.ipAccount1.address,
      this.token1,
      this.token2,
      getBigNumber(10000),
      0,
      800000,
      1200000,
      100000,
      14400);
    await createTX.wait();

    // Expect right ip address
    expect(await this.NudgePoolStatus.getIPAddress(
      this.token1, this.token2)).to.be.equal(this.ipAccount1.address);
    // Expect at auction stage
    expect(await this.NudgePoolStatus.getPoolStage(
      this.token1, this.token2)).to.be.equal(2);

  })

  it("Auction pool", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at auction stage
    if (stage != 2) {
      return
    }

    await this.Token1.connect(this.ipAccount2).approve(this.NudgePool.address, getBigNumber(20000));
    await this.DGT.connect(this.ipAccount2).approve(this.NudgePool.address, getBigNumber(30));

    const auctionTx = await this.NudgePool.connect(this.ipAccount2).auctionPool(
      this.ipAccount2.address,
      this.token1,
      this.token2,
      getBigNumber(20000),
      getBigNumber(30)
    );
    await auctionTx.wait();

    // Expect right ip address
    expect(await this.NudgePoolStatus.getIPAddress(
      this.token1, this.token2)).to.be.equal(this.ipAccount2.address);
    // Expect right ip token amount
    expect(await this.NudgePoolStatus.getIPTokensAmount(
      this.token1, this.token2)).to.be.equal(getBigNumber(20000));
  })
  
  it("Check auction end", async function() {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at auction stage
    if (stage != 2) {
      return
    }

    // Wait to transit
    console.log("At auction stage and wait for Raising stage");
    let transit = await this.NudgePoolStatus.getStageTransit(
    this.token1, this.token2);
    while (transit == false) {
      await sleep(180);
      transit = await this.NudgePoolStatus.getStageTransit(
        this.token1, this.token2);
    }
    console.log("Transit to Raising stage");

    const checkAuctionEndTx = await this.NudgePool.connect(this.ipAccount2).checkAuctionEnd(
      this.token1,
      this.token2
    );
    await checkAuctionEndTx.wait();

    // Expect at raising stage
    expect(await this.NudgePoolStatus.getPoolStage(
      this.token1, this.token2)).to.be.equal(3);
  })

  it("GP deposit raising", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 3) {
      return
    }

    await this.Token2.connect(this.gpAccount1).approve(this.NudgePool.address, getBigNumber(30));

    const gpDepositRaisingTX = await this.NudgePool.connect(this.gpAccount1).GPDepositRaising(
      this.token1,
      this.token2,
      getBigNumber(30),
      true
    );
    await gpDepositRaisingTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(30);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.gpAccount1)).to.be.equal(30)
  })

  it("GP additionally deposit raising", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 3) {
      return
    }

    await this.Token2.connect(this.gpAccount1).approve(this.NudgePool.address, getBigNumber(20));

    const gpDepositRaising = await this.NudgePool.connect(this.gpAccount1).GPDepositRaising(
      this.token1,
      this.token2,
      getBigNumber(20),
      false
    );
    await gpDepositRaising.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(50);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.gpAccount1)).to.be.equal(50)
  })

  it("LP deposit raising", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 3) {
      return
    }

    await this.Token2.connect(this.lpAccount1).approve(this.NudgePool.address, getBigNumber(30));

    const lpDepositRaisingTX = await this.NudgePool.connect(this.lpAccount1).LPDepositRaising(
      this.token1,
      this.token2,
      getBigNumber(30),
      true
    );
    await lpDepositRaisingTX.wait();

    expect(await this.NudgePoolStatus.getCurLPAmount(
      this.token1, this.token2)).to.be.equal(30);
    expect(await this.NudgePoolStatus.getCurLPBaseAmount(
      this.token1,
      this.token2,
      this.lpAccount1)).to.be.equal(30)
  })

  it("LP additionally deposit raising", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 3) {
      return
    }

    await this.Token2.connect(this.lpAccount1).approve(this.NudgePool.address, getBigNumber(20));

    const auctionEndTx = await this.NudgePool.connect(this.lpAccount1).LPDepositRaising(
      this.token1,
      this.token2,
      getBigNumber(20),
      false
    );
    await auctionEndTx.wait();

    expect(await this.NudgePoolStatus.getCurLPAmount(
      this.token1, this.token2)).to.be.equal(50);
    expect(await this.NudgePoolStatus.getCurLPBaseAmount(
      this.token1,
      this.token2,
      this.lpAccount1)).to.be.equal(50)
  })

  it("Check raising end", async function() {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at Raising stage
    if (stage != 3) {
      return
    }

    // Wait to transit
    console.log("At raising stage and wait for running stage");
    let transit = await this.NudgePoolStatus.getStageTransit(
    this.token1, this.token2);
    while (transit == false) {
      await sleep(180);
      transit = await this.NudgePoolStatus.getStageTransit(
        this.token1, this.token2);
    }
    console.log("Transit to running stage");

    const RaisingEndTx = await this.NudgePool.connect(this.ipAccount2).checkRaisingEnd(
      this.token1,
      this.token2
    );
    await RaisingEndTx.wait();

    // Expect at running stage
    expect(await this.NudgePoolStatus.getPoolStage(
      this.token1, this.token2)).to.be.equal(4);
  })

  it("IP deposit running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 3 && stage != 4) {
      return
    }

    await this.Token1.connect(this.ipAccount1).approve(this.NudgePool.address, getBigNumber(20000));

    const ipDepositRaisingTX = await this.NudgePool.connect(this.ipAccount1).IPDepositRaising(
      this.token1,
      this.token2,
      getBigNumber(20000),
      false
    );
    await ipDepositRaisingTX.wait();

    expect(await this.NudgePoolStatus.getIPTokensAmount(
      this.token1, this.token2)).to.be.equal(40000);
  })

  it("GP deposit running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    await this.Token2.connect(this.gpAccount2).approve(this.NudgePool.address, getBigNumber(30));

    const gpDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).GPDepositRunning(
      this.token1,
      this.token2,
      getBigNumber(30),
      true
    );
    await gpDepositRunningTX.wait();

    const gpDoDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).GPDoDepositRunning(
      this.token1,
      this.token2
    );
    await gpDoDepositRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(80);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.gpAccount2)).to.be.equal(30)
  })

  it("GP additionally deposit running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    await this.Token2.connect(this.gpAccount2).approve(this.NudgePool.address, getBigNumber(10));

    const gpDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).GPDepositRunning(
      this.token1,
      this.token2,
      getBigNumber(10),
      false
    );
    await gpDepositRunningTX.wait();

    const gpDoDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).GPDoDepositRunning(
      this.token1,
      this.token2
    );
    await gpDoDepositRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(90);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.gpAccount2)).to.be.equal(40)
  })

  it("GP withdraw running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    const gpWithdrawRunningTX = await this.NudgePool.connect(this.gpAccount1).GPWithdrawRunning(
      this.token1,
      this.token2,
      getBigNumber(10),
    );
    await gpWithdrawRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(40);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.gpAccount1)).to.be.equal(0)
  })

  it("LP deposit running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    await this.Token2.connect(this.gpAccount2).approve(this.NudgePool.address, getBigNumber(30));

    const lpDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).LPDepositRunning(
      this.token1,
      this.token2,
      getBigNumber(30),
      true
    );
    await lpDepositRunningTX.wait();

    const lpDoDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).LPDoDepositRunning(
      this.token1,
      this.token2
    );
    await lpDoDepositRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(80);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.lpAccount2)).to.be.equal(30)
  })

  it("LP additionally deposit running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    await this.Token2.connect(this.gpAccount2).approve(this.NudgePool.address, getBigNumber(20));

    const lpDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).LPDepositRunning(
      this.token1,
      this.token2,
      getBigNumber(20),
      false
    );
    await lpDepositRunningTX.wait();

    const lpDoDepositRunningTX = await this.NudgePool.connect(this.gpAccount1).LPDoDepositRunning(
      this.token1,
      this.token2
    );
    await lpDoDepositRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurGPAmount(
      this.token1, this.token2)).to.be.equal(100);
    expect(await this.NudgePoolStatus.getCurGPBaseAmount(
      this.token1,
      this.token2,
      this.lpAccount2)).to.be.equal(50)
  })

  it("LP withdraw running", async function () {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at finish stage
    if (stage != 4) {
      return
    }

    const lpWithdrawRunningTX = await this.NudgePool.connect(this.gpAccount1).LPWithdrawRunning(
      this.token1,
      this.token2,
      false
    );
    await lpWithdrawRunningTX.wait();

    expect(await this.NudgePoolStatus.getCurLPAmount(
      this.token1, this.token2)).to.be.equal(50);
    expect(await this.NudgePoolStatus.getCurLPBaseAmount(
      this.token1,
      this.token2,
      this.lpAccount1)).to.be.equal(0)
  })

  it("Check running end", async function() {
    const stage = await this.NudgePoolStatus.getPoolStage(this.token1, this.token2);
    // Return while not at ruuning stage
    if (stage != 4) {
      return
    }

    // Wait to transit
    console.log("At running stage and wait for finished stage");
    let transit = await this.NudgePoolStatus.getStageTransit(
    this.token1, this.token2);
    while (transit == false) {
      await sleep(360);
      transit = await this.NudgePoolStatus.getStageTransit(
        this.token1, this.token2);
    }
    console.log("Transit to finished stage");

    const runningEndTx = await this.NudgePool.connect(this.ipAccount2).checkRunningEnd(
      this.token1,
      this.token2
    );
    await runningEndTx.wait();

    // Expect at finished stage
    expect(await this.NudgePoolStatus.getPoolStage(
      this.token1, this.token2)).to.be.equal(0);
  })

  it("Recover Duration", async function () {
    const reDurationTx = await this.NudgePool.setDuration(this.auctionDuration,
                                   this.raisingDuration,this.minimumDuration)
    await reDurationTx.wait();
;
    expect(await this.NudgePool.auctionDuration()).to.be.equal(this.auctionDuration);
    expect(await this.NudgePool.raisingDuration()).to.be.equal(this.raisingDuration);
    expect(await this.NudgePool.minimumDuration()).to.be.equal(this.minimumDuration);
    console.log("DurationRecover")
  })
});
