const { expect } = require('chai');

describe('DYSVesting', function () {
  let Token;
  let dysToken;
  let DYSVesting;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  before(async function () {
    Token = await ethers.getContractFactory('DYSToken');
    DYSVesting = await ethers.getContractFactory('MockDYSVesting');
  });

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    dysToken = await Token.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      1_000_000_000
    );
    await dysToken.deployed();
  });

  describe('Vesting', function () {
    it('Should assign the total supply of tokens to the owner', async function () {
      const ownerBalance = await dysToken.balanceOf(owner.address);
      expect(await dysToken.totalSupply()).to.equal(ownerBalance);
    });

    it('Should vest tokens gradually', async function () {
      // deploy vesting contract
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      expect((await tokenVesting.getToken()).toString()).to.equal(
        dysToken.address
      );
      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);
      const vestingContractBalance = await dysToken.balanceOf(
        tokenVesting.address
      );
      expect(vestingContractBalance).to.equal(1000);
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(1000);

      const baseTime = 1622551248;
      const beneficiary = addr1;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100;

      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );
      expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(1);
      expect(
        await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary.address
        )
      ).to.be.equal(1);

      // total vested at 100
      expect(await tokenVesting.getVestingSchedulesTotalAmount()).to.be.equal(
        100
      );

      // check if withdrawable is now 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);

      // compute vesting schedule id
      const vestingScheduleId =
        await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // check that vested amount is 0
      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(0);

      // set time to half the vesting period
      const halfTime = baseTime + duration / 2;
      await tokenVesting.setCurrentTime(halfTime);

      // check that vested amount is half the total amount to vest
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(50);

      // check that only beneficiary can try to release vested tokens
      await expect(
        tokenVesting.connect(addr2).release(vestingScheduleId, 100)
      ).to.be.revertedWith(
        'DYSVesting: only beneficiary and owner can release vested tokens'
      );

      // check that beneficiary cannot release more than the vested amount
      await expect(
        tokenVesting.connect(beneficiary).release(vestingScheduleId, 100)
      ).to.be.revertedWith(
        'DYSVesting: cannot release tokens, not enough vested tokens'
      );

      // release 10 tokens and check that a Transfer event is emitted with a value of 10
      await expect(
        tokenVesting.connect(beneficiary).release(vestingScheduleId, 10)
      )
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, beneficiary.address, 10)
        .to.emit(tokenVesting, 'Released')
        .withArgs(vestingScheduleId, 10);

      // check that the vested amount is now 40
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(40);

      // check if withdrawable is now 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);

      let vestingSchedule = await tokenVesting.getVestingSchedule(
        vestingScheduleId
      );

      // check that the released amount is 10
      expect(vestingSchedule.released).to.be.equal(10);

      // set current time after the end of the vesting period
      await tokenVesting.setCurrentTime(baseTime + duration + 1);

      // check that the vested amount is 90
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(90);

      // beneficiary release vested tokens (45)
      await expect(
        tokenVesting.connect(beneficiary).release(vestingScheduleId, 45)
      )
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, beneficiary.address, 45)
        .to.emit(tokenVesting, 'Released')
        .withArgs(vestingScheduleId, 45);

      // owner release vested tokens (45)
      await expect(tokenVesting.connect(owner).release(vestingScheduleId, 45))
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, beneficiary.address, 45)
        .to.emit(tokenVesting, 'Released')
        .withArgs(vestingScheduleId, 45);

      vestingSchedule = await tokenVesting.getVestingSchedule(
        vestingScheduleId
      );

      // check that the number of released tokens is 100
      expect(vestingSchedule.released).to.be.equal(100);

      // check that the vested amount is 0
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(0);

      // check that anyone cannot revoke a vesting
      await expect(
        tokenVesting.connect(addr2).revoke(vestingScheduleId)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(tokenVesting.revoke(vestingScheduleId))
        .to.emit(tokenVesting, 'Revoked')
        .withArgs(vestingScheduleId);

      // check if withdrawable is still 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);

      /*
       * TEST SUMMARY
       * deploy vesting contract
       * send tokens to vesting contract
       * create new vesting schedule (100 tokens)
       * check that vested amount is 0
       * set time to half the vesting period
       * check that vested amount is half the total amount to vest (50 tokens)
       * check that only beneficiary can try to release vested tokens
       * check that beneficiary cannot release more than the vested amount
       * release 10 tokens and check that a Transfer event is emitted with a value of 10
       * check that the released amount is 10
       * check that the vested amount is now 40
       * set current time after the end of the vesting period
       * check that the vested amount is 90 (100 - 10 released tokens)
       * release all vested tokens (90)
       * check that the number of released tokens is 100
       * check that the vested amount is 0
       * check that anyone cannot revoke a vesting
       */
    });

    it('Should release vested tokens if revoked', async function () {
      // deploy vesting contract
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      expect((await tokenVesting.getToken()).toString()).to.equal(
        dysToken.address
      );
      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      // check if withdrawable is now 1000
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(1000);

      const baseTime = 1622551248;
      const beneficiary = addr1;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100;

      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

      // check if withdrawable is now 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);

      // compute vesting schedule id
      const vestingScheduleId =
        await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // set time to half the vesting period
      const halfTime = baseTime + duration / 2;
      await tokenVesting.setCurrentTime(halfTime);

      await expect(tokenVesting.revoke(vestingScheduleId))
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, beneficiary.address, 50)
        .to.emit(tokenVesting, 'Released')
        .withArgs(vestingScheduleId, 50)
        .to.emit(tokenVesting, 'Revoked')
        .withArgs(vestingScheduleId);

      // check if withdrawable is now 950
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(950);
    });

    it('Should handle cliff configuration as expected', async function () {
      // deploy vesting contract
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      expect((await tokenVesting.getToken()).toString()).to.equal(
        dysToken.address
      );
      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      const baseTime = 1622551248;
      const beneficiary = addr1;
      const startTime = baseTime;
      const cliff = 500;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = false;
      const amount = 100;

      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

      // compute vesting schedule id
      const vestingScheduleId =
        await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // set time to almost half the vesting period
      const almostHalfTime = baseTime + duration / 2 - 1;
      await tokenVesting.setCurrentTime(almostHalfTime);

      // vested amount should be 0, as cliff was not yet reached
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(0);

      // set time to half the vesting period
      const halfTime = baseTime + duration / 2;
      await tokenVesting.setCurrentTime(halfTime);

      // vested amount should be half the total amount
      expect(
        await tokenVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(50);
    });

    it('Should be unable to revoke vesting period which is not revocable', async function () {
      // deploy vesting contract
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      expect((await tokenVesting.getToken()).toString()).to.equal(
        dysToken.address
      );
      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      const baseTime = 1622551248;
      const beneficiary = addr1;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = false;
      const amount = 100;

      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

      // compute vesting schedule id
      const vestingScheduleId =
        await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      await expect(tokenVesting.revoke(vestingScheduleId)).to.revertedWith(
        'DYSVesting: vesting is not revocable'
      );

      // check if withdrawable is still 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);
    });

    it('Should be able to withdraw the withdrawable amount', async function () {
      // deploy vesting contract
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      expect((await tokenVesting.getToken()).toString()).to.equal(
        dysToken.address
      );
      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      expect(await tokenVesting.getWithdrawableAmount()).to.be.equal(1000);

      await expect(tokenVesting.withdraw(1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, owner.address, 1000);

      expect(await tokenVesting.getWithdrawableAmount()).to.be.equal(0);

      // send tokens to vesting contract again
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      expect(await tokenVesting.getWithdrawableAmount()).to.be.equal(1000);

      const baseTime = 1622551248;
      const beneficiary = addr1;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = false;
      const amount = 100;

      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

      // check if withdrawable is 900
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);

      // cannot withdraw more
      await expect(tokenVesting.withdraw(901)).to.revertedWith(
        'DYSVesting: not enough withdrawable funds'
      );

      // withdraw
      await expect(tokenVesting.withdraw(900))
        .to.emit(dysToken, 'Transfer')
        .withArgs(tokenVesting.address, owner.address, 900);

      // check if withdrawable is 0
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);
    });

    it('Should handle multiple schedules correctly', async function () {
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();

      // send tokens to vesting contract
      await expect(dysToken.transfer(tokenVesting.address, 1000))
        .to.emit(dysToken, 'Transfer')
        .withArgs(owner.address, tokenVesting.address, 1000);

      const baseTime = 1622551248;
      const beneficiary1 = addr1;
      const beneficiary2 = addr2;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = false;
      const amount1 = 100;
      const amount2 = 150;

      // create new vesting schedule for beneficiary1
      await tokenVesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount1
      );
      // create new vesting schedule for beneficiary1
      await tokenVesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount2
      );
      // create new vesting schedule for beneficiary2
      await tokenVesting.createVestingSchedule(
        beneficiary2.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount1
      );

      // check if withdrawable value is correct
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(650);

      // count by beneficiary
      expect(
        await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary1.address
        )
      ).to.be.equal(2);
      expect(
        await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary2.address
        )
      ).to.be.equal(1);

      // get schedule by address and index
      const vesting_beneficiary1_0 =
        await tokenVesting.getVestingScheduleByAddressAndIndex(
          beneficiary1.address,
          0
        );
      expect(vesting_beneficiary1_0.beneficiary).to.be.equal(
        beneficiary1.address
      );
      expect(vesting_beneficiary1_0.amountTotal).to.be.equal(amount1);
      const vesting_beneficiary1_1 =
        await tokenVesting.getVestingScheduleByAddressAndIndex(
          beneficiary1.address,
          1
        );
      expect(vesting_beneficiary1_1.beneficiary).to.be.equal(
        beneficiary1.address
      );
      expect(vesting_beneficiary1_1.amountTotal).to.be.equal(amount2);
      const vesting_beneficiary2_0 =
        await tokenVesting.getVestingScheduleByAddressAndIndex(
          beneficiary2.address,
          0
        );
      expect(vesting_beneficiary2_0.beneficiary).to.be.equal(
        beneficiary2.address
      );
      expect(vesting_beneficiary2_0.amountTotal).to.be.equal(amount1);
    });

    it('Should compute vesting schedule index', async function () {
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      const expectedVestingScheduleId =
        '0xa279197a1d7a4b7398aa0248e95b8fcc6cdfb43220ade05d01add9c5468ea097';
      expect(
        (
          await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
            addr1.address,
            0
          )
        ).toString()
      ).to.equal(expectedVestingScheduleId);
      expect(
        (
          await tokenVesting.computeNextVestingScheduleIdForHolder(
            addr1.address
          )
        ).toString()
      ).to.equal(expectedVestingScheduleId);
    });

    it('Should check input parameters for createVestingSchedule method', async function () {
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      await dysToken.transfer(tokenVesting.address, 1000);
      const time = Date.now();
      await expect(
        tokenVesting.createVestingSchedule(
          addr1.address,
          time,
          0,
          0,
          1,
          false,
          1
        )
      ).to.be.revertedWith('DYSVesting: duration must be > 0');
      await expect(
        tokenVesting.createVestingSchedule(
          addr1.address,
          time,
          0,
          1,
          0,
          false,
          1
        )
      ).to.be.revertedWith('DYSVesting: slicePeriodSeconds must be >= 1');
      await expect(
        tokenVesting.createVestingSchedule(
          addr1.address,
          time,
          0,
          1,
          1,
          false,
          0
        )
      ).to.be.revertedWith('DYSVesting: amount must be > 0');
      await expect(
        tokenVesting.createVestingSchedule(
          addr1.address,
          time,
          0,
          1,
          1,
          false,
          1001
        )
      ).to.be.revertedWith(
        'DYSVesting: cannot create vesting schedule because not sufficient tokens'
      );
    });
  });

  describe('createVestingSchedules', function () {
    it('should create a batch of vesting schedules', async function () {
      const tokenVesting = await DYSVesting.deploy(dysToken.address);
      await tokenVesting.deployed();
      await dysToken.transfer(tokenVesting.address, 1000);
      const start = Math.floor(Date.now() / 1000);
      const vestingSchedules = [
        {
          beneficiary: addr1.address,
          start,
          cliffDelta: 0,
          duration: 1000,
          slicePeriodSeconds: 1,
          revocable: false,
          amount: 500
        },
        {
          beneficiary: addr2.address,
          start,
          cliffDelta: 0,
          duration: 1000,
          slicePeriodSeconds: 1,
          revocable: false,
          amount: 500
        }
      ];
      await tokenVesting.createVestingSchedules(vestingSchedules);
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);
      expect(await tokenVesting.getVestingSchedulesCount()).to.equal(2);
      expect(
        await tokenVesting.getVestingSchedulesCountByBeneficiary(addr1.address)
      ).to.equal(1);
      expect(
        await tokenVesting.getVestingSchedulesCountByBeneficiary(addr2.address)
      ).to.equal(1);
      expect(await tokenVesting.getVestingSchedulesTotalAmount()).to.equal(
        1000
      );
    });
  });
});
