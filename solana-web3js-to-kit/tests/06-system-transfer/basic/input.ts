const ix = SystemProgram.transfer({
  fromPubkey: sender,
  toPubkey: recipient,
  lamports: 1000000,
});
