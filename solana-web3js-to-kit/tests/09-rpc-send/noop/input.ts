import { createSolanaRpc } from '@solana/kit';

// All calls already have .send() — transform should be a no-op
const rpc = createSolanaRpc('https://api.devnet.solana.com');

async function main() {
  const balance = await rpc.getBalance(pubkey).send();
  const slot = await rpc.getSlot().send();
}
