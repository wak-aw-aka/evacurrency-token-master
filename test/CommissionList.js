const Reverter = require('./helpers/reverter');
const CommissionList = artifacts.require('CommissionList');

contract('CommissionList', (accounts) => {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let commissionList;
  const USER = accounts[1];

  before('Setup', async () => {
    commissionList = await CommissionList.new();
    await reverter.snapshot();
  });

  describe('CommissionList', async () => {
    it('should be possible to set refill commission by contract owner', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10,
        1000), true);
      const result = await commissionList.setRefillFor('testSystem', 10, 1000);
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'),
        1000);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'RefillCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 1000);
    });

    it('should be possible to set withdraw commission by contract owner', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem', 10,
        1000), true);
      const result = await commissionList.setWithdrawFor('testSystem', 10,
        1000);
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        1000);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'WithdrawCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 1000);
    });

    it('should be possible to set transfer commission by contract owner', async () => {
      assert.equal(await commissionList.setTransfer.call(10, 1000), true);
      const result = await commissionList.setTransfer(10, 1000);
      assert.equal(await commissionList.getTransferPerc.call(), 1000);
      assert.equal(await commissionList.getTransferStat.call(), 10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'TransferCommissionIsChanged');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 1000);
    });

    it('should not be possible to set refill commission by not contract owner', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10,
        1000, {from: USER}), false);
      await commissionList.setRefillFor('testSystem', 10, 1000, {from: USER});
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'), 0);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'), 0);
    });

    it('should not be possible to set withdraw commission by not contract owner', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem', 10,
        1000, {from: USER}), false);
      await commissionList.setWithdrawFor('testSystem', 10, 1000, {from: USER});
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        0);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        0);
    });

    it('should not be possible to set transfer commission by not contract owner', async () => {
      assert.equal(await commissionList.setTransfer.call(10, 1000,
        {from: USER}), false);
      await commissionList.setTransfer(10, 1000, {from: USER});
      assert.equal(await commissionList.getTransferPerc.call(), 0);
      assert.equal(await commissionList.getTransferStat.call(), 0);
    });

    it('should not be possible to set refill commission by contract owner with negative perc', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10, -1,
        {from: USER}), false);
      await commissionList.setRefillFor('testSystem', 10, -1, {from: USER});
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'), 0);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'), 0);
    });

    it('should not be possible to set withdraw commission by contract owner with negative perc', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem',
        10, -1, {from: USER}), false);
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        0);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        0);
    });

    it('should not be possible to set transfer commission by contract owner with negative perc', async () => {
      assert.equal(await commissionList.setTransfer.call(10, -1, {from: USER}),
        false);
      assert.equal(await commissionList.getTransferPerc.call(), 0);
      assert.equal(await commissionList.getTransferStat.call(), 0);
    });

    it('should not be possible to set refill commission by contract owner with perc > 10000', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10,
        1000000, {from: USER}), false);
      await commissionList.setRefillFor('testSystem', 10, -1, {from: USER});
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'), 0);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'), 0);
    });

    it('should not be possible to set withdraw commission by contract owner with perc > 10000', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem', 10,
        1000000, {from: USER}), false);
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        0);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        0);
    });

    it('Should not be possible to set transfer commission by contract owner with perc > 10000', async () => {
      assert.equal(await commissionList.setTransfer.call(10, 100001,
        {from: USER}), false);
      assert.equal(await commissionList.getTransferPerc.call(), 0);
      assert.equal(await commissionList.getTransferStat.call(), 0);
    });

    it('should be possible to set refill commission by contract owner with perc = 0', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10, 0),
        true);
      const result = await commissionList.setRefillFor('testSystem', 10, 0);
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'), 0);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'RefillCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 0);
    });

    it('should be possible to set withdraw commission by contract owner with perc = 0', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem', 10,
        0), true);
      const result = await commissionList.setWithdrawFor('testSystem', 10, 0);
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        0);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'WithdrawCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 0);
    });

    it('should be possible to set transfer commission by contract owner with perc = 0', async () => {
      assert.equal(await commissionList.setTransfer.call(10, 0), true);
      const result = await commissionList.setTransfer(10, 0);
      assert.equal(await commissionList.getTransferPerc.call(), 0);
      assert.equal(await commissionList.getTransferStat.call(), 10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'TransferCommissionIsChanged');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 0);
    });

    it('should be possible to set refill commission by contract owner with perc = 10000', async () => {
      assert.equal(await commissionList.setRefillFor.call('testSystem', 10,
        10000), true);
      const result = await commissionList.setRefillFor('testSystem', 10, 10000);
      assert.equal(await commissionList.getRefillPercFor.call('testSystem'),
        10000);
      assert.equal(await commissionList.getRefillStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'RefillCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 10000);
    });

    it('should be possible to set withdraw commission by contract owner with perc = 10000', async () => {
      assert.equal(await commissionList.setWithdrawFor.call('testSystem', 10,
        10000), true);
      const result = await commissionList.setWithdrawFor('testSystem', 10,
        10000);
      assert.equal(await commissionList.getWithdrawPercFor.call('testSystem'),
        10000);
      assert.equal(await commissionList.getWithdrawStatFor.call('testSystem'),
        10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'WithdrawCommissionIsChanged');
      assert.equal(result.logs[0].args.paySystem, 'testSystem');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 10000);
    });

    it('should be possible to set transfer commission by contract owner with perc = 10000', async () => {
      assert.equal(await commissionList.setTransfer.call(10, 10000), true);
      const result = await commissionList.setTransfer(10, 10000);
      assert.equal(await commissionList.getTransferPerc.call(), 10000);
      assert.equal(await commissionList.getTransferStat.call(), 10);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'TransferCommissionIsChanged');
      assert.equal(result.logs[0].args.stat, 10);
      assert.equal(result.logs[0].args.perc, 10000);
    });
  });

  describe('calcWithdraw', async () => {
    it('should calculate commission correctly with stat = 10, perc = 1000, value = 100', async () => {
      const resultCommission = 20;
      await commissionList.setWithdrawFor('testSystem', 10, 1000);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 2, perc = 100, value = 100', async () => {
      const resultCommission = 3;
      await commissionList.setWithdrawFor('testSystem', 2, 100);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 1100, value = 100', async () => {
      const resultCommission = 11;
      await commissionList.setWithdrawFor('testSystem', 0, 1100);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 1150, value = 100', async () => {
      const resultCommission = 111;
      await commissionList.setWithdrawFor('testSystem', 100, 1150);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 0, value = 100', async () => {
      const resultCommission = 100;
      await commissionList.setWithdrawFor('testSystem', 100, 0);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 0, value = 0', async () => {
      const resultCommission = 0;
      await commissionList.setWithdrawFor('testSystem', 0, 0);
      assert.equal(await commissionList.calcWithdraw('testSystem', 0),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 9999, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setWithdrawFor('testSystem', 0, 9999);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 99, perc = 0, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setWithdrawFor('testSystem', 99, 0);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 50, perc = 1000, value = 100', async () => {
      const resultCommission = 60;
      await commissionList.setWithdrawFor('testSystem', 50, 1000);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 50, perc = 100, value = 100', async () => {
      const resultCommission = 51;
      await commissionList.setWithdrawFor('testSystem', 50, 100);
      assert.equal(await commissionList.calcWithdraw('testSystem', 100),
        resultCommission);
    });
  });

  describe('calcRefill', async () => {
    it('should calculate commission correctly with stat = 10, perc = 1000, value = 100', async () => {
      const resultCommission = 20;
      await commissionList.setRefillFor('testSystem', 10, 1000);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 2, perc = 100, value = 100', async () => {
      const resultCommission = 3;
      await commissionList.setRefillFor('testSystem', 2, 100);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 1100, value = 100', async () => {
      const resultCommission = 11;
      await commissionList.setRefillFor('testSystem', 0, 1100);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 1150, value = 100', async () => {
      const resultCommission = 111;
      await commissionList.setRefillFor('testSystem', 100, 1150);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 0, value = 100', async () => {
      const resultCommission = 100;
      await commissionList.setRefillFor('testSystem', 100, 0);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 10000, value = 100', async () => {
      const resultCommission = 100;
      await commissionList.setRefillFor('testSystem', 0, 10000);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 99, perc = 0, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setRefillFor('testSystem', 99, 0);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 0, value = 0', async () => {
      const resultCommission = 0;
      await commissionList.setRefillFor('testSystem', 0, 0);
      assert.equal(await commissionList.calcRefill('testSystem', 0),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 9999, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setRefillFor('testSystem', 0, 9999);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 50, perc = 1000, value = 100', async () => {
      const resultCommission = 60;
      await commissionList.setRefillFor('testSystem', 50, 1000);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });

    it('should calculate commission correctly with stat = 50, perc = 1100, value = 100', async () => {
      const resultCommission = 61;
      await commissionList.setRefillFor('testSystem', 50, 1100);
      assert.equal(await commissionList.calcRefill('testSystem', 100),
        resultCommission);
    });
  });

  describe('calcTransfer', async () => {
    it('should calculate commission correctly with stat = 10, perc = 1000, value = 100', async () => {
      const resultCommission = 20;
      await commissionList.setTransfer(10, 1000);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 2, perc = 100, value = 100', async () => {
      const resultCommission = 3;
      await commissionList.setTransfer(2, 100);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 1100, value = 100', async () => {
      const resultCommission = 11;
      await commissionList.setTransfer(0, 1100);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 1150, value = 100', async () => {
      const resultCommission = 111;
      await commissionList.setTransfer(100, 1150);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 100, perc = 0, value = 100', async () => {
      const resultCommission = 100;
      await commissionList.setTransfer(100, 0);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 10000, value = 100', async () => {
      const resultCommission = 100;
      await commissionList.setTransfer(0, 10000);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 9900, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setTransfer(0, 9900);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 0, value = 0', async () => {
      const resultCommission = 0;
      await commissionList.setTransfer(0, 0);
      assert.equal(await commissionList.calcTransfer(0), resultCommission);
    });

    it('should calculate commission correctly with stat = 0, perc = 9999, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setTransfer(0, 9999);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 99, perc = 0, value = 100', async () => {
      const resultCommission = 99;
      await commissionList.setTransfer(99, 0);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('should calculate commission correctly with stat = 50, perc = 1000, value = 100', async () => {
      const resultCommission = 61;
      await commissionList.setTransfer(50, 1100);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });

    it('sАhould calculate commission correctly with stat = 50, perc = 10000, value = 100', async () => {
      const resultCommission = 50;
      await commissionList.setTransfer(50, 10);
      assert.equal(await commissionList.calcTransfer(100), resultCommission);
    });
  });
});

