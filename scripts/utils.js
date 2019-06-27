const Promise = require('bluebird');

module.exports = ((EToken, _gasPrice = '20000000000') => {
  const $logs = undefined;
  const web3 = EToken.web3;
  const eth = web3.eth;
  let address;
  let sender;

  const nowSeconds = function() {
    return Math.floor(Date.now() / 1000);
  };

  const gasPrice = web3.toBigNumber(_gasPrice);

  const setPrivateKey = function(pk) {
    EToken.setPrivateKey(pk);
    address = EToken.privateToAddress(('0x' + pk).slice(-64));
    sender = address;
    log(
      'Your address(global variable `address` ' +
      'or `sender`) to send transactions: ' + address,
      $logs
    );
    return sender;
  };

  const _log = function(message, logger) {
    logger.prepend(message);
  };

  const log = function(message, logger) {
    console.log(message);
    if (logger) {
      _log('<p>' + message + '</p>', logger);
    }
  };

  const logError = function(message, logger, dontThrow) {
    if (logger) {
      _log('<p class="error">' + message + '</p>', logger);
    }
    if (dontThrow) {
      return;
    }
    throw message;
  };

  const logSuccess = function(gas, result, params, logger) {
    if (logger) {
      const txHash = result.length === 66 ? '<a href="http://etherscan.io/tx/' + result + '" target="_blank">' + result + '</a>' : result;
      _log(
        '<p class="success">Success! Gas used: ' +
        gas + ' result: ' + txHash +
        (params ? ' params: ' + params : '') + '</p>',
        logger);
    }
    console.log('Success! Gas used: ' + gas +
      ' result: ' + result + (params ? ' params: ' + params : '')
    );
  };

  const logWaiting = function(logger) {
    if (logger) {
      $(logger.children()[0]).append('.');
    }
  };

  const logFinish = function(logger) {
    if (logger) {
      _log('<hr/>', logger);
    }
    console.log('------------------------------------------------------------');
  };

  const safeTransactionFunction = function(fun, params, sender, argsObject) {
    if (arguments.length === 0) {
      log(
        'See safeTransaction(). To be used as part of safeTransactions().',
        $logs
      );
      return;
    }
    const merge = function(base, args) {
      const target = ['nonce', 'value', 'gasPrice', 'to', 'data'];
      if (args) {
        while (target.length > 0) {
          const arg = target.pop();
          if (args[arg]) {
            base[arg] = args[arg];
          }
        }
      }
      return base;
    };

    const processFunctionParams = function(paramsToProcess) {
      for (let i = 0; i < paramsToProcess.length; i++) {
        if (typeof paramsToProcess[i] === 'function') {
          paramsToProcess[i] = paramsToProcess[i]();
        }
      }
    };

    let gas = argsObject && argsObject.gas || 500000;
    return function(testRun, fastRun) {
      processFunctionParams(params);
      return new Promise(function(resolve, reject) {
        const _params = params.slice(0);
        _params.push(
          merge(
            {
              from: sender,
              gas: Math.max(3000000, gas),
              gasPrice: gasPrice,
            },
            argsObject
          )
        );
        _params.push('pending');
        _params.push(function(err, result) {
          if (err) {
            if (err.toString().toLowerCase().includes('execution error')) {
              if (fastRun) {
                resolve(gas);
                return;
              }
            }
            if (err.toString()
            .startsWith('Error: no contract code at given address')
            ) {
              gas = argsObject && argsObject.gas || 21000;
              resolve(gas);
              return;
            }
            reject(err);
          } else {
            resolve(result);
          }
        });
        if (typeof fun.call === 'string') {
          eth.estimateGas(..._params);
        } else {
          fun.estimateGas(..._params);
        }
      }).then(function(estimateGas) {
        return new Promise(function(resolve, reject) {
          const _params = params.slice(0);
          if (estimateGas > gas) {
            reject('Estimate gas is too big: ' + estimateGas);
          } else if (
            typeof fun.call === 'string' ||
            fastRun ||
            (argsObject && argsObject.ignoreCallResponse)
          ) {
            // simple eth.sendTransaction
            resolve(estimateGas);
          } else {
            const repeater = function(tries, funcToCall, funcToCallArgs) {
              const _repeat = function() {
                if (tries-- === 0) {
                  return false;
                }
                logWaiting($logs);
                setTimeout(() => funcToCall(...funcToCallArgs), 500);
                return true;
              };
              return _repeat;
            };
            const repeat = repeater(600, fun.call, _params);
            _params.push(
              merge(
                {
                  from: sender,
                  gas: gas,
                  gasPrice: gasPrice,
                },
                argsObject
              )
            );
            _params.push('pending');
            _params.push(function(err, result) {
              if (err) {
                reject(err);
              } else {
                const success = typeof result.toNumber === 'function' ?
                  result.toNumber() > 0 : result;
                if (success) {
                  resolve(estimateGas);
                } else {
                  if (!repeat()) {
                    reject(
                      'Call with gas: ' + gas + ' returned ' +
                      result.toString() + ' 40 times in a row.'
                    );
                  }
                }
              }
            });
            repeat();
          }
        });
      }).then(function(estimateGas) {
        return new Promise(function(resolve, reject) {
          const _params = params.slice(0);
          _params.push(
            merge(
              {
                from: sender,
                gas: gas,
                gasPrice: gasPrice,
              },
              argsObject
            )
          );
          _params.push(function(err, result) {
            if (err) {
              reject(err);
            } else {
              resolve([result, estimateGas]);
            }
          });
          if (testRun || (argsObject && argsObject.testRun)) {
            resolve(['OK', estimateGas]);
            return;
          }
          fun(..._params);
        });
      }).then(function(result) {
        const value = (argsObject && argsObject.value) ?
          ' value: ' + web3.fromWei(argsObject.value.valueOf(), 'ether') +
          ' ETH.' : '';
        const to = (argsObject && argsObject.to) ? ' to: ' + argsObject.to : '';
        const nonce = (argsObject && argsObject.nonce !== undefined) ?
          ' nonce: ' + argsObject.nonce : '';
        logSuccess(
          result[1], result[0], params.join(', ') + to + value + nonce,
          $logs
        );
        if (testRun || (argsObject && argsObject.testRun)) {
          return [false, result[1]];
        }
        return new Promise(function(resolve, reject) {
          if (argsObject && argsObject.waitReceipt) {
            log('Waiting receipt for ' + result[0], $logs);
            const startTime = nowSeconds();
            const waitReceipt = function(txHash) {
              web3.eth.getTransactionReceipt(txHash, function(err, receipt) {
                const secondsPassed = Math.round(nowSeconds() - startTime);
                if (receipt && receipt.blockNumber) {
                  resolve([secondsPassed, result[1]]);
                } else {
                  logWaiting($logs);
                  setTimeout(function() {
                    waitReceipt(txHash);
                  }, 1000);
                }
              });
            };
            return waitReceipt(result[0]);
          }
          if (fastRun) {
            return resolve([false, result[1]]);
          }
          return waitTransactionEvaluation(result[0])
          .then(() => resolve([false, result[1]]))
          .catch(reject);
        });
      }).then(function(results) {
        if (results[0]) {
          log('Mined in ' + results[0] + ' seconds.', $logs);
        }
        return [results[1], argsObject && argsObject.value];
      });
    };
  };

  const safeTransactions = function(...args) {
    const _safeTransactions = function(
      txFunctions,
      testRun,
      fastRun,
      cumulativeGasUsed,
      totalValueSpent
    ) {
      if (arguments.length === 0) {
        log(
          'safeTransactions(safeFunctionsArray[, testRun[, fastRun]]);',
          $logs
        );
        return Promise.resolve();
      }
      cumulativeGasUsed = cumulativeGasUsed || 0;
      totalValueSpent = totalValueSpent || 0;
      if (txFunctions.length === 0) {
        log(
          'Done! Cumulative gas used: ' + cumulativeGasUsed +
          ', total value sent: ' + web3.fromWei(totalValueSpent, 'ether') +
          ' ETH.',
          $logs
        );
        logFinish($logs);
        return Promise.resolve();
      }
      return txFunctions.shift()(testRun, fastRun)
      .then(function(gasUsedAndvalueSpent) {
        const gasUsed = gasUsedAndvalueSpent && gasUsedAndvalueSpent[0] || 0;
        const valueSent = web3.toBigNumber(
          gasUsedAndvalueSpent && gasUsedAndvalueSpent[1] || 0
        );
        return _safeTransactions(
          txFunctions,
          testRun,
          fastRun,
          cumulativeGasUsed + gasUsed,
          valueSent.add(totalValueSpent)
        );
      });
    };
    return _safeTransactions(...args)
    .catch(function(err) {
      logError(err, $logs, true);
      log('<hr/>', $logs);
      throw err;
    });
  };

  const smartDeployContract = function(args) {
    if (arguments.length === 0) {
      log(
        'smartDeployContract({constructorArgs, bytecode, abi, ' +
        'sender, name, gas, nonce, waitReceipt, fastRun, deployedAddress});',
        $logs
      );
      return;
    }
    const constructorArgs = args.constructorArgs || [];
    const bytecode = args.bytecode;
    const abi = args.abi || [];
    const sender = args.sender;
    const name = args.name;
    const gas = args.gas;
    const nonce = args.nonce;
    const waitReceipt = args.waitReceipt;
    const fastRun = args.fastRun;
    const deployedAddress = args.deployedAddress;
    const params = {
      from: sender,
      data: bytecode[1] === 'x' ? bytecode : '0x' + bytecode,
      gas: gas || 3900000, // leave some space for other transactions
      gasPrice: gasPrice,
    };
    if (nonce !== undefined) {
      params.nonce = nonce;
    }
    let processed = false;
    if (deployedAddress) {
      return Promise.resolve(eth.contract(abi).at(deployedAddress));
    }
    return new Promise((resolve, reject) => {
      eth.contract(abi).new(
        ...constructorArgs,
        params,
        (e, contract) => {
          if (e) {
            return reject(e);
          }
          if (waitReceipt) {
            if (typeof contract.address != 'undefined') {
              log(
                `Contract mined! address: ${contract.address} ` +
                `transactionHash: ${contract.transactionHash}`,
                $logs
              );
              return resolve(eth.contract(abi).at(contract.address));
            } else {
              log(
                `Contract deployment result: ${contract.transactionHash}.` +
                ` Waiting for receipt.`,
                $logs
              );
            }
          } else {
            if (processed) {
              return;
            }
            processed = true;
            log(
              `Contract deployment result: ${contract.transactionHash}`,
              $logs
            );
            getTransaction(contract.transactionHash)
            .then((tx) => {
              const result = eth.contract(abi).at(tx.creates);
              if (fastRun) {
                return result;
              }
              return waitTransactionEvaluation(contract.transactionHash)
              .then(() => result);
            }).then(resolve).catch(reject);
          }
        }
      );
    }).then((contract) => {
      if (name) {
        window[name] = contract;
        log(
          `Deployed contract is accessible by '${name}' global variable.`,
          $logs
        );
      }
      return contract;
    });
  };

  return {
    setPrivateKey,
    safeTransactionFunction,
    safeTransactions,
    smartDeployContract,
    nowSeconds,
  };
});
