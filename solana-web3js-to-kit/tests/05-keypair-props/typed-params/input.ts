async function transfer(authority: Keypair, feePayer: KeyPairSigner) {
  const kp = Keypair.generate();
  console.log(authority.publicKey);
  console.log(feePayer.publicKey);
  console.log(kp.publicKey);
  const secret = kp.secretKey;
}
