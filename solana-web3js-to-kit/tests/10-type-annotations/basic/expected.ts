import { createSolanaRpc, address, generateKeyPairSigner } from '@solana/kit';
import type { Address, IInstruction, KeyPairSigner } from '@solana/kit';

function transfer(from: KeyPairSigner, to: Address, amount: number): Promise<void> {
  return Promise.resolve();
}

async function buildIx(payer: KeyPairSigner): Promise<IInstruction> {
  const dest: Address = address('abc');
  const instructions: IInstruction[] = [];
  return instructions[0];
}
