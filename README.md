# eva-currency
Contracts and deployment of Eva Currency.
=========

# Installation

**NodeJS 8.x+ along with build-essential must be installed as a prerequisite.**
```
$ npm install
```

# Running tests

```
$ npm run ganache
$ npm run test
```

# Deploying

Set Ethereum node URL and gas price in the ./scripts/config.js.
Running **./deploy -h** will produce usage information.

```
./deploy -h
usage: deploy [-h] [-v] --private-key hex [--eth-node-url url]
              [--gas-price number] --name string --symbol string
              --customerOwner address [--ambi2 address]
              

EvaCurrency deployment scripts

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  --private-key hex     Private key to send transactions.
  --eth-node-url url    URL for Ethereum node JSON RPC endpoint. (default 
                        gets from config file)
  --gas-price number    Gas price in wei. (default gets from config file)
  --name string         Token name
  --symbol string       Token symbol
  --customerOwner address
                        Owner address controlled by customer
  --ambi2 address       Address of the predeployed Ambi2 contract. [deploy]

Developed by Ambisafe
```

# Contributing ![JS Code Style](https://img.shields.io/badge/js--style-extends--google-green.svg "JS Code Style")

In order to validate consistency of your changes run:
```
$ npm run validate
```

## Code Style

JS: based on Google, though with only single indentations even for arguments.
