import { createSolanaRpc } from '@solana/kit';

const rpc = createSolanaRpc('https://api.devnet.solana.com');

async function main() {
  const balance = await rpc.getBalance(pubkey).send();
  const slot = await rpc.getSlot().send();
  const info = await rpc.getAccountInfo(pubkey, { encoding: 'base64' }).send();
  const already = await rpc.getBalance(pubkey).send();
}
