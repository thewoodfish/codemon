import { generateKeyPairSigner } from '@solana/kit';

async function main() {
  const keypair = await generateKeyPairSigner();
  console.log(keypair);
}

// Non-async — should NOT be transformed
function syncFunc() {
  const keypair = Keypair.generate();
}
