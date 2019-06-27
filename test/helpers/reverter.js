'use strict';

// using web3 version 1.0 from truffle

function Reverter() {
  let snapshotId;

  this.revert = () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        id: new Date().getTime(),
        params: [snapshotId],
      }, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(this.snapshot());
      });
    });
  };

  this.snapshot = () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: new Date().getTime(),
      }, (err, result) => {
        if (err) {
          return reject(err);
        }
        snapshotId = web3.utils.hexToNumber(result.result);
        return resolve();
      });
    });
  };
}

module.exports = Reverter;
