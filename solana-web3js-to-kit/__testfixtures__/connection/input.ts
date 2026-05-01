import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const connection = createSolanaRpc('https://api.mainnet-beta.solana.com');
const connectionWithCommitment = createSolanaRpc('https://api.devnet.solana.com');
