async function send() {
  await /* TODO: create via sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) */ sendAndConfirmTransaction(tx, { signers: [keypair], commitment: 'confirmed' });
}
