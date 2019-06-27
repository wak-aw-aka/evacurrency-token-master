module.exports = {

  plugins: ['truffle-security'],

  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      gas: 8000000,
    },
  },

  compilers: {
    solc: {
      version: '0.5.8',
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000,
        },
        evmVersion: 'byzantium',
      },
    },
  },
};
