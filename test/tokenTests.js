const Reverter = require('./helpers/reverter');
const asserts = require('./helpers/asserts')(assert);
const bytes32 = require('./helpers/bytes32');
const EvaCurrency = artifacts.require('EvaCurrency');
const Resolver = artifacts.require('Resolver');
const Router = artifacts.require('Router');
const Mock = artifacts.require('Mock');
const AddressList = artifacts.require('AddressList');
const CommissionList = artifacts.require('CommissionList');
const Ambi2 = artifacts.require('Ambi2');

let token;
let ambi2;
let resolverBase;
let evaCurrency;
let router;
let mockAmbi2;
let mockAddressList;
let mockCommissionList;
let addressList;
let commissionList;
const tokenTestResult = {isFullyERC20: true, transfer: {}, transferFrom: {}};
let testError;

const bytes1 = '0x' + '0'.repeat(63) + '1';
const accountBalance = 100;

const mockCalcRefill = async (paySystem, amount, returns) => {
  await mockCommissionList.expectStaticCall(token.address, 0,
    commissionList.contract.methods.calcRefill(
      paySystem, amount.toString()).encodeABI(),
    returns);
};


contract('EvaCurrency token', (accounts) => {
  const reverter = new Reverter(web3);
  const HOLDER = accounts[1];
  const SPENDER = accounts[2];
  const RECEIVER = accounts[4];
  const HOLDERZEROBALANCE = accounts[3];
  const PLACEHOLDER = 'cafecafecafecafecafecafecafecafecafecafe';
  const OWNER = accounts[0];
  const MODER = accounts[5];
  const TRUE = bytes32(1);

  function replaceAll(input, find, replace) {
    return input.split(find).join(replace);
  }

  const mockModer = async (addr, returns) => {
    await mockAddressList.expectStaticCall(token.address, 0,
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

  before('setup', async function() {
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
    token = await EvaCurrency.at(resolverBase.address);

    await router.updateVersion(evaCurrency.address);
    await token.constructEvaCurrency('testName', 'testSymbol');

    addressList = await AddressList.at(mockAddressList.address);
    commissionList = await CommissionList.at(mockCommissionList.address);
    await token.setLists(
      mockCommissionList.address, mockAddressList.address);

    await mockModer(MODER, TRUE);

    await mockCalcRefill('paySystem', accountBalance, bytes32(0));
    await token.refill(HOLDER, accountBalance, 'paySystem', {from: MODER});

    await reverter.snapshot();
  });

  it('should have name property by default', async function() {
    tokenTestResult.name = await token.name();
  });

  it('should have decimals property by default', async function() {
    tokenTestResult.decimals = await token.decimals();
  });

  it('should have totalSupply property by default', async function() {
    tokenTestResult.totalSupply = await token.totalSupply();
  });

  it('should have symbol property by default', async function() {
    tokenTestResult.symbol = await token.symbol();
  });

  it('should be possible to get default balanceOf', async function() {
    tokenTestResult.balanceOf = await token.balanceOf(RECEIVER);
  });

  it('should be possible to get default allowance', async function() {
    tokenTestResult.allowance = await token.allowance(RECEIVER, HOLDER);
  });

  it('should be possible to make approve', async function() {
    await token.approve(SPENDER, 10, {from: HOLDER});
    assert.equal(await token.allowance(HOLDER, SPENDER), 10);

    tokenTestResult.approve = true;
  });

  it('should emit indexed Approve event on approve', async function() {
    const result = await token.approve(SPENDER, 10, {from: HOLDER});
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].event, 'Approval');
    assert.equal(result.logs[0].args.from, HOLDER);
    assert.equal(result.logs[0].args.spender, SPENDER);
    assert.equal(result.logs[0].args.value, 10);
    tokenTestResult.approveEvent = true;
  });

  describe('Transfer', () => {
    it('should be possible to make valid transfer with positive balance and return bytes(1) on transfer', async function() {
      assert.equal(await token.transfer.call(RECEIVER, 1, {from: HOLDER}),
        true);
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await token.transfer(RECEIVER, 1, {from: HOLDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 1);
      assert.equal(await token.balanceOf(RECEIVER), 1);
      tokenTestResult.transfer.validTransfer = true;
    });

    it('should emit indexed Transfer event on transfer with positive balance', async function() {
      const validTransferResult = await token.transfer(RECEIVER, 1,
        {from: HOLDER});

      assert.equal(validTransferResult.logs.length, 1);
      assert.equal(validTransferResult.logs[0].event, 'Transfer');
      assert.equal(validTransferResult.logs[0].args.from. HOLDER);
      assert.equal(validTransferResult.logs[0].args.to, RECEIVER);
      assert.equal(validTransferResult.logs[0].args.value, 1);
      tokenTestResult.transfer.validTransferEvent = true;
    });

    it('should be possible to make zero transfer and return bytes(1) on transfer', async function() {
      assert.equal(await token.transfer.call(RECEIVER, 0), bytes1);
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await token.transfer(RECEIVER, 0);
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      tokenTestResult.transfer.validZeroTransfer = true;
    });

    it('should emit indexed Transfer event on zero transfer', async function() {
      const validTransferResult = await token.transfer(RECEIVER, 0,
        {from: HOLDER});

      assert.equal(validTransferResult.logs.length, 1);
      assert.equal(validTransferResult.logs[0].event, 'Transfer');
      assert.equal(validTransferResult.logs[0].args.from. HOLDER);
      assert.equal(validTransferResult.logs[0].args.to, RECEIVER);
      assert.equal(validTransferResult.logs[0].args.value, 0);
      tokenTestResult.transfer.validTransferEvent = true;
    });

    it('should be possible to transfer all coins and return bytes(1) on transfer', async function() {
      assert.equal(await token.transfer.call(RECEIVER, accountBalance,
        {from: HOLDER}), bytes1);
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await token.transfer(RECEIVER, accountBalance, {from: HOLDER});
      assert.equal(await token.balanceOf(HOLDER), 0);
      assert.equal(await token.balanceOf(RECEIVER), accountBalance);
      tokenTestResult.transfer.validTransferAll = true;
    });

    it('should emit indexed Transfer event on transfer all coins', async function() {
      const validTransferResult = await token.transfer(RECEIVER,
        accountBalance, {from: HOLDER});

      assert.equal(validTransferResult.logs.length, 1);
      assert.equal(validTransferResult.logs[0].event, 'Transfer');
      assert.equal(validTransferResult.logs[0].args.from. HOLDER);
      assert.equal(validTransferResult.logs[0].args.to, RECEIVER);
      assert.equal(validTransferResult.logs[0].args.value, accountBalance);
      tokenTestResult.transfer.validTransferEvent = true;
    });

    it('should be possible to transfer to oneself, or not', async function() {
      assert.equal(await token.transfer.call(HOLDER, 1, {from: HOLDER}),
        bytes1);
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      await token.transfer(HOLDER, 1, {from: HOLDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      tokenTestResult.transfer.transferToOneself = true;
    });

    it('should not be possible to transfer amount 1 with balance 0', async function() {
      assert.equal(await token.balanceOf(accounts[2]), 0);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await asserts.throws(token.transfer(RECEIVER, 1,
        {from: accounts[2]}));
      assert.equal(await token.balanceOf(accounts[2]), 0);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      tokenTestResult.transfer.transferPositiveAmountFromZeroBalance = true;
    });

    it('should not be possible to transfer amount 101 with balance 100', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await asserts.throws(token.transfer(RECEIVER, accountBalance + 1));
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      tokenTestResult.transfer.transferMoreThanAvailableBalance = true;
    });
  });

  describe('Allowance Transfer', () => {
    it('should be possible to do allowance transfer by allowed spender', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(RECEIVER), 0);
      await token.approve(SPENDER, 200, {from: HOLDER});
      assert.equal(await token.transferFrom.call(HOLDER, RECEIVER, 100,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, RECEIVER, 100, {from: SPENDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 100);
      assert.equal(await token.balanceOf(RECEIVER), 100);
      tokenTestResult.transferFrom.validByAllowedSpender = true;
    });

    it('should emit indexed Transfer event on allowance transfer', async function() {
      await token.approve(SPENDER, 200, {from: HOLDER});
      const validAllowanceTransferResult =
          await token.transferFrom(HOLDER, RECEIVER, 100, {from: SPENDER});

      assert.equal(validAllowanceTransferResult.logs.length, 1);
      assert.equal(validAllowanceTransferResult.logs[0].event, 'Transfer');
      assert.equal(validAllowanceTransferResult.logs[0].args.from. HOLDER);
      assert.equal(validAllowanceTransferResult.logs[0].args.to, RECEIVER);
      assert.equal(validAllowanceTransferResult.logs[0].args.value,
        accountBalance);
      tokenTestResult.transfer.validTransferEvent = true;
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 50, {from: HOLDER});
      assert.equal(await token.transferFrom.call(HOLDER, SPENDER, 50,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, SPENDER, 50, {from: SPENDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 50);
      assert.equal(await token.balanceOf(SPENDER), 50);
      tokenTestResult.transferFrom.validLessThanBalanceEqualAllowed = true;
    });

    it('should be possible to do allowance transfer with value equal to balance and less than allowed', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 200, {from: HOLDER});
      assert.equal(await token.transferFrom.call(HOLDER, SPENDER, 100,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, SPENDER, 100, {from: SPENDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 100);
      assert.equal(await token.balanceOf(SPENDER), 100);
      tokenTestResult.transferFrom.validEqualBalanceLessThanAllowed = true;
    });

    it('should be possible to do allowance transfer with value equal to balance and equal to allowed', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 100, {from: HOLDER});
      assert.equal(await token.transferFrom.call(HOLDER, SPENDER, 100,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, SPENDER, 100, {from: SPENDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 100);
      assert.equal(await token.balanceOf(SPENDER), 100);
      tokenTestResult.transferFrom.validEqualBalanceEqualAllowed = true;
    });

    it('should be possible to do allowance transfer with value less than balance and less than allowed after another transfer', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 80, {from: HOLDER});
      await token.transferFrom(HOLDER, accounts[4], 1, {from: SPENDER});

      assert.equal(await token.transferFrom.call(HOLDER, SPENDER, 20,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, SPENDER, 20, {from: SPENDER});

      assert.equal(await token.balanceOf(HOLDER), accountBalance - 20 - 1);
      assert.equal(await token.balanceOf(SPENDER), 20);
      tokenTestResult.transferFrom
      .validLessThanBalanceLessThanAllowedAfterAnotherTransfer = true;
    });

    it('should be possible to do allowance transfer with value less than balance and equal to allowed after another transfer', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 80, {from: HOLDER});
      await token.transferFrom(HOLDER, accounts[4], 10, {from: SPENDER});

      assert.equal(await token.transferFrom.call(HOLDER, SPENDER, 70,
        {from: SPENDER}), bytes1);
      await token.transferFrom(HOLDER, SPENDER, 70, {from: SPENDER});

      assert.equal(await token.balanceOf(HOLDER), accountBalance - 70 - 10);
      assert.equal(await token.balanceOf(SPENDER), 70);
      tokenTestResult.transferFrom
      .validLessThanBalanceEqualToAllowedAfterAnotherTransfer = true;
    });

    it('should return 0 allowance after another transfer', async function() {
      await token.approve(SPENDER, 100, {from: HOLDER});
      assert.equal(await token.allowance(HOLDER, SPENDER), 100);
      await token.transferFrom(HOLDER, accounts[4], 100, {from: SPENDER});

      assert.equal(await token.allowance(HOLDER, SPENDER), 0);
      tokenTestResult.transferFrom.zeroAllowanceAfterAllowedTransfer = true;
    });

    it('should return 1 allowance after another transfer', async function() {
      await token.approve(SPENDER, 100, {from: HOLDER});
      assert.equal(await token.allowance(HOLDER, SPENDER), 100);
      await token.transferFrom(HOLDER, accounts[4], 99, {from: SPENDER});

      assert.equal(await token.allowance(HOLDER, SPENDER), 1);
      tokenTestResult.transferFrom
      .positiveAllowanceAfterAllowedTransfer = true;
    });

    it('should be possible to do allowance transfer from and to the same holder, or not', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 1, {from: HOLDER});
      await token.transferFrom(HOLDER, HOLDER, 1, {from: SPENDER});
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.transferFromToSameHolder = true;
    });

    it('should not be possible to do allowance transfer by not allowed existing spender', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await asserts.throws(token.transferFrom(HOLDER, SPENDER, 1,
        {from: SPENDER}));
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.notAllowedSpender = true;
    });

    it('should not be possible to do allowance transfer with holders zero balance', async function() {
      assert.equal(await token.balanceOf(HOLDERZEROBALANCE), 0);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 1, {from: HOLDERZEROBALANCE});
      await asserts.throws(token.transferFrom(HOLDERZEROBALANCE,
        SPENDER, 1, {from: SPENDER}));
      assert.equal(await token.balanceOf(HOLDERZEROBALANCE), 0);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.holderZeroBalance = true;
    });

    it('should not be possible to do allowance transfer, more than allowed', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 50, {from: HOLDER});
      await asserts.throws(token.transferFrom(HOLDER, SPENDER, 51,
        {from: SPENDER}));
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.moreThanAllowed = true;
    });

    it('should not be possible to do allowance transfer with value more than balance, less than allowed', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 101, {from: HOLDER});
      await asserts.throws(token.transferFrom(HOLDER, SPENDER, 101,
        {from: SPENDER}));
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.moreThanBalanceLessThanAllowance = true;
    });

    it('should not be possible to do allowance transfer with value less than balance, more than allowed after another transfer', async function() {
      assert.equal(await token.balanceOf(HOLDER), accountBalance);
      assert.equal(await token.balanceOf(SPENDER), 0);
      await token.approve(SPENDER, 110, {from: HOLDER});
      token.transferFrom(HOLDER, accounts[5], 10, {from: SPENDER});
      await asserts.throws(token.transferFrom(HOLDER, SPENDER,
        accountBalance, {from: SPENDER}));
      assert.equal(await token.balanceOf(HOLDER), accountBalance - 10);
      assert.equal(await token.balanceOf(SPENDER), 0);
      tokenTestResult.transferFrom.afterAnotherTransfer = true;
    });
  });

  afterEach('log error', () => {
    if (testError) {
      logError(testError.message);
      testError = undefined;
    }
  });

  afterEach('revert', reverter.revert);
});

const logError = (message) => {
  console.log(chalk.red(message));
};
