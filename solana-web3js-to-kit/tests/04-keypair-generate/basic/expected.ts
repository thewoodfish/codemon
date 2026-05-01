async function main() {
  const keypair = await generateKeyPairSigner();
  console.log(keypair);
}

function syncFunc() {
  const keypair = Keypair.generate();
}
