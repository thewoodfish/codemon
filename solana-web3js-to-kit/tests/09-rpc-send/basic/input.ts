import { createSolanaRpc } from '@solana/kit';

const rpc = createSolanaRpc('https://api.devnet.solana.com');

async function main() {
  const balance = await rpc.getBalance(pubkey);
  const slot = await rpc.getSlot();
  const info = await rpc.getAccountInfo(pubkey, { encoding: 'base64' });
  const already = await rpc.getBalance(pubkey).send();
}
