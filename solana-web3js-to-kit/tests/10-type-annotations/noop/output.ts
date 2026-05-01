import { createSolanaRpc, address, generateKeyPairSigner } from '@solana/kit';
import type { Address, KeyPairSigner } from '@solana/kit';

// Already migrated — no v1 type identifiers present
function transfer(from: KeyPairSigner, to: Address, amount: number): void {}
