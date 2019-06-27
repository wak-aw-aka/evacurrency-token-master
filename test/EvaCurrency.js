const Reverter = require('./helpers/reverter');
const bytes32 = require('./helpers/bytes32');
const asserts = require('./helpers/asserts')(assert);
const assertErrorMessage = require('./helpers/assertErrorMessage')(assert);
const EvaCurrency = artifacts.require('EvaCurrency');
const Resolver = artifacts.require('Resolver');
const Router = artifacts.require('Router');
const Mock = artifacts.require('Mock');
const AddressList = artifacts.require('AddressList');
const CommissionList = artifacts.require('CommissionList');
const Ambi2 = artifacts.require('Ambi2');
const util = require('ethereumjs-util');

const bn = (number) => {
  return web3.utils.toBN(number);
};

contract('EvaCurrency', (accounts) => {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let evaCurrency;
  let ambi2;
  let resolverBase;
  let resolver;
  let router;
  let mockAmbi2;
  let mockAddressList;
  let mockCommissionList;
  let addressList;
  let commissionList;
  const PLACEHOLDER = 'cafecafecafecafecafecafecafecafecafecafe';
  const OWNER = accounts[0];
  const USER = accounts[1];
  const MODER = accounts[2];
  const SIGNER_PK = util.toBuffer(
    '0x33dcaecb60aa76a06f13831182e0265be024323b0b3c4bc07cf8c69a186c67e8');
  const SIGNER_ADDRESS = '0xa0C74F2485d564f1f368B845Edb79F5Ca2415DD7';
  const TRUE = bytes32(1);
  const FALSE = bytes32(0);
  const ZERO_ADDRESS = '0x' + '0'.repeat(40);
  const paySystem = 'testSystem';

  function replaceAll(input, find, replace) {
    return input.split(find).join(replace);
  }

  const assertBalance = async (addr, bal) => {
    assert.equal((await resolver.balanceOf(addr)), bal);
  };

  const mockCalcRefill = async (paySystem, amount, returns) => {
    await mockCommissionList.expectStaticCall(resolver.address, 0,
      commissionList.contract.methods.calcRefill(
        paySystem, amount.toString()).encodeABI(),
      returns);
  };

  const mockCalcTransfer = async (amount, returns) => {
    await mockCommissionList.expectStaticCall(resolver.address, 0,
      commissionList.contract.methods.calcTransfer(
        amount.toString()).encodeABI(),
      returns);
  };

  const mockCalcWithdraw = async (paySystem, amount, returns) => {
    await mockCommissionList.expectStaticCall(resolver.address, 0,
      commissionList.contract.methods.calcWithdraw(
        paySystem, amount).encodeABI(),
      returns);
  };

  const mockModer = async (addr, returns) => {
    await mockAddressList.expectStaticCall(resolver.address, 0,
      addressList.contract.methods.onList(addr).encodeABI(), returns);
  };

  const mockExpectRole = (sender, from, role, to, returns) => {
    return mockAmbi2.expectStaticCall(sender, 0,
      ambi2.contract.methods.hasRole(from, role, to).encodeABI(), returns);
  };

  const mockExpectAmbi2Claimed = (consumer, claimer, sender, returns) => {
    return mockAmbi2.expect(consumer, 0,
      ambi2.contract.methods.claimFor(claimer, sender).encodeABI(), returns);
  };

  before('Setup', async () => {
    mockAmbi2 = await Mock.new();
    mockAddressList = await Mock.new();
    mockCommissionList = await Mock.new();

    ambi2 = await Ambi2.at(mockAmbi2.address);

    evaCurrency = await EvaCurrency.new();
    router = await Router.new();

    await mockExpectAmbi2Claimed(router.address, router.address, OWNER, TRUE);
    router.setupAmbi2(mockAmbi2.address);
    await mockExpectRole(router.address, router.address,
      web3.utils.fromAscii('admin'), OWNER, TRUE);

    Resolver.bytecode = replaceAll(Resolver.bytecode, PLACEHOLDER,
      router.address.replace('0x', '')).toLowerCase();

    resolverBase = await Resolver.new();
    resolver = await EvaCurrency.at(resolverBase.address);

    await router.updateVersion(evaCurrency.address);
    await resolver.constructEvaCurrency('testName', 'testSymbol');

    addressList = await AddressList.at(mockAddressList.address);
    commissionList = await CommissionList.at(mockCommissionList.address);
    await resolver.setLists(
      mockCommissionList.address, mockAddressList.address);

    await mockModer(MODER, TRUE);

    await reverter.snapshot();
  });

  describe('setLists', async () => {
    it('should be possible to set lists', async () => {
      const result = await resolver.setLists(accounts[5],
        accounts[6]);

      assert.isTrue(await resolver.setLists.call(accounts[5],
        accounts[6]));
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'ListsSet');
      assert.equal(result.logs[0].args.commissionList,
        accounts[5]);
      assert.equal(result.logs[0].args.addList,
        accounts[6]);
    });

    it('should not be possible to set lists not from contract owner', async () => {
      assert.isFalse(await resolver.setLists.call(accounts[5],
        accounts[6], {from: USER}));
      const result = await resolver.setLists(accounts[5],
        accounts[6], {from: USER});

      assertErrorMessage(result, 'Not a contract owner');

      assert.equal(await resolver.commissionList(),
        mockCommissionList.address);
      assert.equal(await resolver.moderList(),
        mockAddressList.address);
    });
  });

  describe('changeStaker', async () => {
    it('should be possible to change staker address', async () => {
      const result = await resolver.changeStaker(USER);

      assert.isTrue(await resolver.changeStaker.call(USER));

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'StakerChanged');
      assert.equal(result.logs[0].args.oldStaker, OWNER);
      assert.equal(result.logs[0].args.newStaker, USER);
    });

    it('should not be possible to change staker not from contract owner', async () => {
      assert.isFalse(await resolver.changeStaker.call(USER, {from: USER}));
      const result = await resolver.changeStaker(USER, {from: USER});

      assertErrorMessage(result, 'Not a contract owner');

      assert.equal(await resolver.staker(), OWNER);
    });
  });

  describe('refill', async () => {
    it('should set name and symbol by default', async () => {
      assert.equal(await resolver.name(), 'testName');
      assert.equal(await resolver.symbol(), 'testSymbol');
    });

    it('should presets lists from hook', async () => {
      assert.equal(await resolver.moderList(), mockAddressList.address);
      assert.equal(
        await resolver.commissionList(), mockCommissionList.address);
    });

    it('should be possible to refill from moder', async () => {
      const amount = 100;
      const commissionBytes = bytes32(5);
      const commission = 5;

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);
      await assertBalance(USER, 0);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      await resolver.refill(USER, amount, paySystem, {from: MODER});
      assert.equal(await resolver.totalSupply(), amount + commission);
      await assertBalance(USER, amount);
      await assertBalance(OWNER, commission);
    });

    it('should emit events on refill', async () => {
      const amount = 100;
      const commissionBytes = bytes32(5);
      const commission = 5;

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);
      const result = await resolver.refill(
        USER, amount, paySystem, {from: MODER});

      assert.equal(result.logs.length, 3);
      assert.equal(result.logs[0].event, 'Mint');
      assert.equal(result.logs[0].args.holder, USER);
      assert.equal(result.logs[0].args.amount, amount + commission);

      assert.equal(result.logs[1].event, 'Transfer');
      assert.equal(result.logs[1].args.from, ZERO_ADDRESS);
      assert.equal(result.logs[1].args.to, USER);
      assert.equal(result.logs[1].args.value, amount + commission);

      assert.equal(result.logs[2].event, 'Transfer');
      assert.equal(result.logs[2].args.from, USER);
      assert.equal(result.logs[2].args.to, OWNER);
      assert.equal(result.logs[2].args.value, commission);
    });

    it('should throw on refill from NOT moder', async () => {
      const amount = 100;
      const notModer = accounts[3];
      const commissionBytes = bytes32(5);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);


      await mockModer(notModer, FALSE);

      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      await asserts.throws(
        resolver.refill(USER, amount, paySystem, {from: notModer}),
        'Called not by moder');
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
    });

    it('should throw on refill when paused', async () => {
      const amount = 100;
      const commissionBytes = bytes32(5);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);

      await resolver.pause();
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      await asserts.throws(
        resolver.refill(USER, amount, paySystem, {from: MODER}), 'Paused');
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
    });

    it('should be possible to refill from moder with fee more than value', async () => {
      const amount = 100;
      const commission = 101;
      const commissionBytes = bytes32(101);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);

      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      assert.isTrue(
        await resolver.refill.call(USER, amount, paySystem, {from: MODER}));

      await resolver.refill(USER, amount, paySystem, {from: MODER});
      await assertBalance(USER, amount);
      await assertBalance(OWNER, commission);
      assert.equal(await resolver.totalSupply(), amount + commission);
    });

    it('should throw on refill when paused', async () => {
      const amount = 100;
      const commissionBytes = bytes32(5);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);

      await resolver.pause();
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      await asserts.throws(
        resolver.refill(USER, amount, paySystem, {from: MODER}), 'Paused');
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
    });

    it('should throw on value + fee overflow', async () => {
      const amount = bn(2).pow(bn(256)).subn(1);
      const commissionBytes = bytes32(1);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);

      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);
      await asserts.throws(
        resolver.refill(USER, amount, paySystem, {from: MODER}));
      await assertBalance(USER, 0);
      await assertBalance(OWNER, 0);
      assert.equal((await resolver.totalSupply()).toString(), 0);
    });

    it('should throw on total supply overflow', async () => {
      const overflowAmount = bn(2).pow(bn(256)).subn(1);
      const amount = 1;
      const commissionBytes = bytes32(0);

      // add commission
      await mockCalcRefill(paySystem, amount, commissionBytes);

      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), 0);

      await resolver.refill(USER, amount, paySystem, {from: MODER});

      await mockCalcRefill(paySystem, overflowAmount, commissionBytes);

      await asserts.throws(
        resolver.refill(USER, overflowAmount, paySystem, {from: MODER}));

      await assertBalance(USER, 1);
      await assertBalance(OWNER, 0);
      assert.equal((await resolver.totalSupply()).toString(), 1);
    });
  });

  describe('transferOnBehalf', async () => {
    it('should be possible to transfer with vrs from moder', async () => {
      const refillAmount = 100;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const commissionTransfer = 5;
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');

      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount - transferAmount -
        commissionTransfer);
      await assertBalance(USER, transferAmount);
      assert.equal(await resolver.totalSupply(), refillAmount);
    });

    it('should emit events on transfer with vrs', async () => {
      const refillAmount = 100;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const commissionTransfer = 5;
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      const result = await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      assert.equal(result.logs.length, 2);
      assert.equal(result.logs[0].event, 'Transfer');
      assert.equal(result.logs[0].args.from, SIGNER_ADDRESS);
      assert.equal(result.logs[0].args.to, USER);
      assert.equal(
        result.logs[0].args.value, transferAmount);

      assert.equal(result.logs[1].event, 'Transfer');
      assert.equal(result.logs[1].args.from, SIGNER_ADDRESS);
      assert.equal(result.logs[1].args.to, OWNER);
      assert.equal(result.logs[1].args.value, commissionTransfer);
    });

    it('should throw on transfer with vrs from NOT moder', async () => {
      const refillAmount = 100;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      const notModer = accounts[3];
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      await mockModer(notModer, FALSE);
      await asserts.throws(resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: notModer}), 'Called not by moder');
      assert.equal(await resolver.totalSupply(), refillAmount);
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
    });

    it('should throw on transfer with vrs if paused', async () => {
      const refillAmount = 100;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
      await resolver.pause();
      await asserts.throws(resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER}), 'Paused');
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
    });

    it('should not be possible to transfer with vrs if used nonce provided', async () => {
      const refillAmount = 100;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});

      assert.isFalse(await resolver.transferOnBehalf.call(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER}));

      const result = await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});

      assertErrorMessage(result, 'Invalid nonce');
    });

    it('should not be possible on transfer with vrs if not enough balance', async () => {
      const refillAmount = 19;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
      assert.isFalse(await resolver.transferOnBehalf.call(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER}));

      const result = await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);

      assertErrorMessage(result, 'Insufficient funds');
    });

    it('should not be possible to transfer with vrs if not enough balance to cover amount + fee', async () => {
      const refillAmount = 21;
      const transferAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const transferAmountBytes = bytes32(transferAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);
      assert.isFalse(await resolver.transferOnBehalf.call(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER}));

      const result = await resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(USER, 0);

      assertErrorMessage(result, 'Insufficient funds');
    });

    it('should throw on value + fee overflow', async () => {
      const refillAmount = bn(2).pow(bn(256)).subn(1);
      const transferAmount = bn(2).pow(bn(256)).subn(1);
      const commissionBytes = bytes32(0);
      const commissionBytesTransfer = bytes32(1);
      const nonce = 1;
      const nonceBytes = bytes32(nonce);
      const transferAmountBytes = bytes32(transferAmount);

      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount.toString());

      // add commission for transferOnBehalf
      await mockCalcTransfer(transferAmount, commissionBytesTransfer);

      const params = USER + transferAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await asserts.throws(resolver.transferOnBehalf(USER, transferAmount,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER}));
    });
  });

  describe('withdrawOnBehalf', async () => {
    it('should be possible to withdraw with vrs from moder', async () => {
      const refillAmount = 100;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const commissionWithdraw = 5;
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      await resolver.withdrawOnBehalf(withdrawAmount, paySystem,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount - withdrawAmount);
      await assertBalance(OWNER, commissionWithdraw);
      assert.equal(await resolver.totalSupply(),
        refillAmount - withdrawAmount + commissionWithdraw);
    });

    it('should emit events on withdraw with vrs', async () => {
      const refillAmount = 100;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const commissionWithdraw = 5;
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      result = await resolver.withdrawOnBehalf(withdrawAmount, paySystem,
        nonce, sig.v, util.bufferToHex(sig.r), util.bufferToHex(sig.s),
        {from: MODER});
      assert.equal(result.logs.length, 3);
      assert.equal(result.logs[0].event, 'Burn');
      assert.equal(result.logs[0].args.holder, SIGNER_ADDRESS);
      assert.equal(
        result.logs[0].args.value, withdrawAmount - commissionWithdraw);
      assert.equal(result.logs[1].event, 'Transfer');
      assert.equal(result.logs[1].args.from, SIGNER_ADDRESS);
      assert.equal(result.logs[1].args.to, ZERO_ADDRESS);
      assert.equal(
        result.logs[1].args.value, withdrawAmount - commissionWithdraw);

      assert.equal(result.logs[2].event, 'Transfer');
      assert.equal(result.logs[2].args.from, SIGNER_ADDRESS);
      assert.equal(result.logs[2].args.to, OWNER);
      assert.equal(result.logs[2].args.value, commissionWithdraw);
    });

    it('should throw on withdraw with vrs from NOT moder', async () => {
      const refillAmount = 100;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      const notModer = accounts[3];
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      await mockModer(notModer, FALSE);
      await asserts.throws(resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: notModer}), 'Called not by moder');
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
    });

    it('should throw on withdraw vrs when paused', async () => {
      const refillAmount = 100;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      await resolver.pause();
      await asserts.throws(resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER}), 'Paused');
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
    });

    it('should not be possible to withdraw vrs if used nonce provided', async () => {
      const refillAmount = 100;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER});

      assert.isFalse(await resolver.withdrawOnBehalf.call(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER}));

      const result = await resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER});
      assertErrorMessage(result, 'Invalid nonce');
    });

    it('should not be possible to withdraw with vrs if not enough balance', async () => {
      const refillAmount = 19;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      assert.isFalse(await resolver.withdrawOnBehalf.call(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER}));

      const result = await resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);

      assertErrorMessage(result, 'Insufficient funds');
    });

    it('should be possible to withdraw with vrs if amount + fee > balance and amount > fee', async () => {
      const refillAmount = 21;
      const withdrawAmount = 20;
      const commissionBytes = bytes32(0);
      const commissionBytesWithdraw = bytes32(5);
      const commissionWithdraw = 5;
      const nonce = 1;
      const nonceBytes = bytes32(nonce).replace('0x', '');
      const withdrawAmountBytes = bytes32(withdrawAmount).replace('0x', '');
      // add commission for refill
      await mockCalcRefill(paySystem, refillAmount, commissionBytes);
      await resolver.refill(
        SIGNER_ADDRESS, refillAmount, paySystem, {from: MODER});

      // add commission for withdrawOnBehalf
      await mockCalcWithdraw(paySystem, withdrawAmount,
        commissionBytesWithdraw);

      const params = ZERO_ADDRESS + withdrawAmountBytes +
        nonceBytes + resolver.address.substr(2);
      const hash = web3.utils.sha3(params, {encoding: 'hex'});
      const sig = util.ecsign(util.toBuffer(hash), SIGNER_PK);

      await assertBalance(SIGNER_ADDRESS, refillAmount);
      await assertBalance(OWNER, 0);
      assert.equal(await resolver.totalSupply(), refillAmount);
      assert.isTrue(await resolver.withdrawOnBehalf.call(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER}));

      await resolver.withdrawOnBehalf(withdrawAmount,
        paySystem, nonce, sig.v, util.bufferToHex(sig.r),
        util.bufferToHex(sig.s), {from: MODER});
      await assertBalance(SIGNER_ADDRESS, refillAmount - withdrawAmount);
      await assertBalance(OWNER, commissionWithdraw);
      assert.equal(await resolver.totalSupply(),
        refillAmount - withdrawAmount + commissionWithdraw);
    });
  });
});

