'use strict';

// using web3 version 1.0 from truffle

function assertErrorMessage(assert) {
  return (result, errorMessage) => {
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].event, 'Error');
    assert.equal(web3.utils.hexToUtf8(
      result.logs[0].args.message), errorMessage);
  };
}

module.exports = assertErrorMessage;
