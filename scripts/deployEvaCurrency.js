'use strict';

const config = require('./config');

const ArgumentParser = require('argparse').ArgumentParser;
const Promise = require('bluebird');
const assert = require('assert');

const EvaCurrency = require('../build/contracts/EvaCurrency.json');
const Resolver = require('../build/contracts/Resolver.json');
const Router = require('../build/contracts/Router.json');
const Ambi2 = require('../build/contracts/Ambi2.json');
const AddressList = require('../build/contracts/AddressList.json');
const CommissionList = require('../build/contracts/CommissionList.json');

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'EvaCurrency deployment scripts',
  epilog: 'Developed by Ambisafe',
});

parser.addArgument(
  ['--private-key'], {
    help: 'Private key to send transactions.',
    dest: 'privateKey',
    required: true,
    metavar: 'hex',
  }
);

parser.addArgument(
  ['--eth-node-url'], {
    help: 'URL for Ethereum node JSON RPC endpoint. ' +
    '(default gets from config file)',
    dest: 'rpc',
    metavar: 'url',
    defaultValue: config.rpcUrl,
  }
);

parser.addArgument(
  ['--gas-price'], {
    help: 'Gas price in wei. (default gets from config file)',
    dest: 'gas',
    metavar: 'number',
    defaultValue: config.gasPrice,
  }
);

parser.addArgument(
  ['--name'], {
    help: 'Token name.',
    dest: 'name',
    metavar: 'string',
    required: true,
  }
);

parser.addArgument(
  ['--symbol'], {
    help: 'Token symbol.',
    dest: 'symbol',
    metavar: 'string',
    required: true,
  }
);

parser.addArgument(
  ['--evaOwner'], {
    help: 'Owner address controlled by Eva.',
    dest: 'evaOwner',
    metavar: 'address',
    required: true,
  }
);

parser.addArgument(
  ['--ambi2'], {
    help: 'Address of the predeployed Ambi2 contract. [deploy]',
    dest: 'ambi2Address',
    required: false,
    metavar: 'address',
  }
);

const parsedArgs = parser.parseArgs();

const ETokenLib = require('etoken-lib');
const EToken = new ETokenLib(parsedArgs.rpc);
const Utils = require('./utils')(EToken, config.gasPrice);
const web3 = EToken.web3;
const eth = Promise.promisifyAll(web3.eth);

const {smartDeployContract, setPrivateKey, safeTransactions,
  safeTransactionFunction, nowSeconds} = Utils;

const address = setPrivateKey(parsedArgs.privateKey.slice(-64));

const AFTER_ONE_DAY = nowSeconds() + 86400;
const OWNER = '__root__';
const ADMIN = 'admin';

function replaceAll(input, find, replace) {
  return input.split(find).join(replace);
}

function sanityCheck() {
  assert(
    web3.isAddress(parsedArgs.evaOwner),
    'evaOwner address is not specified or invalid');
  assert(
    parsedArgs.evaOwner.toLowerCase() !== address.toLowerCase(),
    'evaOwner address should be different from sender address');
  assert(
    !parsedArgs.ambi2Address || web3.isAddress(parsedArgs.ambi2Address),
    'Ambi2 address is not valid');
}

async function deployEvaCurrency() {
  sanityCheck();

  const ambi2 = await smartDeployContract({
    bytecode: Ambi2.bytecode,
    abi: Ambi2.abi,
    sender: address,
    deployedAddress: parsedArgs.ambi2Address,
    waitReceipt: true,
  });

  const name = parsedArgs.name;
  const symbol = parsedArgs.symbol;
  const PLACEHOLDER = 'cafecafecafecafecafecafecafecafecafecafe';

  const addressList = await smartDeployContract({
    bytecode: AddressList.bytecode,
    abi: AddressList.abi,
    sender: address,
    constructorArgs: ['moderList', true],
    waitReceipt: true,
  });

  const commissionList = await smartDeployContract({
    bytecode: CommissionList.bytecode,
    abi: CommissionList.abi,
    sender: address,
    waitReceipt: true,
  });

  const evaCurrency = await smartDeployContract({
    bytecode: EvaCurrency.bytecode,
    abi: EvaCurrency.abi,
    sender: address,
    waitReceipt: true,
  });

  const router = await smartDeployContract({
    bytecode: Router.bytecode,
    abi: Router.abi,
    sender: address,
    waitReceipt: true,
  });

  await safeTransactions([
    safeTransactionFunction(router.setupAmbi2, [ambi2.address], address),
    safeTransactionFunction(ambi2.assignRoleWithExpiration, [
      router.address, ADMIN, address, AFTER_ONE_DAY], address),
    safeTransactionFunction(ambi2.assignOwner,
      [router.address, parsedArgs.evaOwner], address),
    safeTransactionFunction(ambi2.assignRole, [router.address,
      ADMIN, parsedArgs.evaOwner], address),
    safeTransactionFunction(ambi2.unassignRole,
      [router.address, OWNER, address], address),
  ], false, true);

  const fixedResolverBytecode = replaceAll(Resolver.bytecode, PLACEHOLDER,
    router.address.replace('0x', ''));

  const resolver = await smartDeployContract({
    bytecode: fixedResolverBytecode,
    abi: EvaCurrency.abi,
    sender: address,
    waitReceipt: true,
  });
  await safeTransactions([
    safeTransactionFunction(router.updateVersion, [evaCurrency.address],
      address),
    safeTransactionFunction(resolver.constructEvaCurrency, [name, symbol],
      address),
    safeTransactionFunction(resolver.setLists,
      [commissionList.address, addressList.address], address,
      {waitReceipt: true}),
  ], false, true);

  const resolverAsync = Promise.promisifyAll(
    eth.contract(EvaCurrency.abi).at(resolver.address));
  const ambi2Async = Promise.promisifyAll(
    eth.contract(Ambi2.abi).at(ambi2.address));

  console.log('-------------------------');
  console.log('Checks that evaOwner has admin role, must be true:',
    await ambi2Async.hasRoleAsync(router.address, ADMIN,
      parsedArgs.evaOwner));
  console.log('Checks that evaOwner has owner role, must be true:',
    await ambi2Async.hasRoleAsync(router.address, OWNER,
      parsedArgs.evaOwner));
  console.log('Name:', await resolverAsync.nameAsync());
  console.log('Symbol:', await resolverAsync.symbolAsync());
  console.log('Set CommissionList address in evaCurrency contract:',
    await resolverAsync.commissionListAsync());
  console.log('Set ModerList address in evaCurrency contract:',
    await resolverAsync.moderListAsync());
  console.log('Staker address:',
    await resolverAsync.stakerAsync());
  console.log('-------------------------');

  console.log('Resolver(Main contract, i.e. token) -', resolver.address);
  console.log('EvaCurrencyPrototype(Current version) -', evaCurrency.address);
  console.log('Router(Upgrade manager) -', router.address);
  console.log('Ambi2(Upgrade access manager contract) -', ambi2.address);
}

deployEvaCurrency()
.catch((err) => console.error(`Execution error: ${err.message || err}`));
