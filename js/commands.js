export const commands = [
  {
    method: 'eth_blockNumber',
    label: 'eth_blockNumber',
    chip: 'eth_blockNumber',
    category: 'Chain',
    params: [],
    decode: (result) => {
      const n = parseInt(result, 16);
      return `Block #${n.toLocaleString()}`;
    },
  },
  {
    method: 'eth_chainId',
    label: 'eth_chainId',
    chip: 'eth_chainId',
    category: 'Chain',
    params: [],
    decode: (result) => `Chain ID: ${parseInt(result, 16)}`,
  },
  {
    method: 'eth_gasPrice',
    label: 'eth_gasPrice',
    chip: 'gasPrice',
    category: 'Chain',
    params: [],
    decode: (result) => {
      const gwei = parseInt(result, 16) / 1e9;
      return `${gwei.toFixed(4)} Gwei`;
    },
  },
  {
    method: 'eth_getBalance',
    label: 'eth_getBalance',
    chip: 'eth_getBalance',
    category: 'Account',
    params: [
      { name: 'address', placeholder: '0x...', required: true },
      { name: 'block', placeholder: 'latest', default: 'latest' },
    ],
    decode: (result) => {
      const wei = BigInt(result);
      const eth = Number(wei) / 1e18;
      return `${eth.toFixed(6)} ETH`;
    },
  },
  {
    method: 'eth_getBlockByNumber',
    label: 'eth_getBlockByNumber',
    chip: 'getBlock',
    category: 'Chain',
    params: [
      { name: 'block', placeholder: 'latest', default: 'latest' },
      { name: 'fullTxs', placeholder: 'false', default: false, type: 'boolean' },
    ],
    decode: null,
  },
  {
    method: 'eth_getTransactionCount',
    label: 'eth_getTransactionCount',
    chip: 'getNonce',
    category: 'Account',
    params: [
      { name: 'address', placeholder: '0x...', required: true },
      { name: 'block', placeholder: 'latest', default: 'latest' },
    ],
    decode: (result) => `Nonce: ${parseInt(result, 16)}`,
  },
  {
    method: 'seismic_getTeePublicKey',
    label: 'seismic_getTeePublicKey',
    chip: 'TEE PubKey',
    category: 'Seismic',
    params: [],
    decode: null,
  },
  {
    method: 'net_version',
    label: 'net_version',
    chip: 'net_version',
    category: 'Network',
    params: [],
    decode: null,
  },
  {
    method: 'web3_clientVersion',
    label: 'web3_clientVersion',
    chip: 'web3_clientVersion',
    category: 'Network',
    params: [],
    decode: null,
  },
];

export function findCommand(method) {
  return commands.find((c) => c.method === method);
}

export function getMethodNames() {
  return commands.map((c) => c.method);
}
