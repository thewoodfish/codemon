import { createSolanaRpc, address, generateKeyPairSigner } from '@solana/kit';

function transfer(from: Keypair, to: PublicKey, amount: number): Promise<void> {
  return Promise.resolve();
}

async function buildIx(payer: Keypair): Promise<TransactionInstruction> {
  const dest: PublicKey = address('abc');
  const instructions: TransactionInstruction[] = [];
  return instructions[0];
}
