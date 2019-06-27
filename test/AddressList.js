const Reverter = require('./helpers/reverter');
const AddressList = artifacts.require('AddressList');

contract('addressList', (accounts) => {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let addressList;
  const USER = accounts[1];
  const zeroAddress = '0x' + '0'.repeat(40);

  before('Setup', async () => {
    addressList = await AddressList.new('moderList', true);
    await reverter.snapshot();
  });

  describe('AddressList', async () => {
    it('Should be possible to set user to list', async () => {
      const result = await addressList.changeList(USER, true);
      assert.equal(await addressList.changeList.call(USER, true), true);
      assert.equal(await addressList.onList(USER), true);
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'ChangeWhiteList');
      assert.equal(result.logs[0].args.to, USER);
      assert.equal(result.logs[0].args.onList, true);
    });

    it('Should not be possible to set list by not contract owner', async () => {
      await addressList.changeList(USER, true, {from: USER});
      assert.equal(await addressList.changeList.call(USER, true, {from: USER}),
        false);
      assert.equal(await addressList.onList(USER), false);
    });

    it('Should be possible to remove address from list', async () => {
      const result1 = await addressList.changeList(USER, true);

      assert.equal(await addressList.changeList.call(USER, true), true);
      assert.equal(await addressList.onList(USER), true);

      assert.equal(result1.logs.length, 1);
      assert.equal(result1.logs[0].event, 'ChangeWhiteList');
      assert.equal(result1.logs[0].args.to, USER);
      assert.equal(result1.logs[0].args.onList, true);

      const result2 = await addressList.changeList(USER, false);

      assert.equal(await addressList.changeList.call(USER, false), true);
      assert.equal(await addressList.onList(USER), false);

      assert.equal(result2.logs.length, 1);
      assert.equal(result2.logs[0].event, 'ChangeWhiteList');
      assert.equal(result2.logs[0].args.to, USER);
      assert.equal(result2.logs[0].args.onList, false);
    });

    it('Should not be possible to set zero address to list', async () => {
      assert.equal(await addressList.changeList.call(zeroAddress, true), false);
      assert.equal(await addressList.changeList.call(zeroAddress, false),
        false);
      assert.equal(await addressList.onList(zeroAddress), true);
    });
  });
});
