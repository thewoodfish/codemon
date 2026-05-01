import { createSolanaRpc } from '@solana/kit';

const rpc = new Connection('https://api.mainnet-beta.solana.com');
const rpc2 = new Connection('https://api.devnet.solana.com', 'confirmed');
