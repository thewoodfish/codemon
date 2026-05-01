import { createSolanaRpc, createSolanaRpcSubscriptions, address, generateKeyPairSigner, createTransactionMessage, pipe, getTransferSolInstruction, LAMPORTS_PER_SOL, sendAndConfirmTransactionFactory } from '@solana/kit';

const rpcUrl = 'https://api.mainnet-beta.solana.com';
