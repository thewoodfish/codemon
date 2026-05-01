async function transfer(authority: Keypair, feePayer: KeyPairSigner) {
  const kp = Keypair.generate();
  console.log(authority.address);
  console.log(feePayer.address);
  console.log(kp.address);
  const secret = kp.privateKey;
}
