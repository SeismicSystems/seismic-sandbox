export const networks = {
  testnet: {
    name: 'Seismic Testnet',
    rpc: 'https://gcp-2.seismictest.net/rpc',
    chainId: 5124,
    explorer: 'https://socialscan.io',
    faucet: 'https://faucet.seismictest.net',
  },
  devnet: {
    name: 'Seismic Devnet',
    rpc: 'https://node-2.seismicdev.net/rpc',
    chainId: 5124,
    explorer: 'https://explorer-2.seismicdev.net',
    faucet: 'https://faucet-2.seismicdev.net',
  },
};

export const defaultNetwork = 'testnet';
export const RPC_TIMEOUT_MS = 15000;
