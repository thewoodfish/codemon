async function send() {
  await /* TODO: ensure sendAndConfirmTransaction is created via sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) */ await sendAndConfirmTransaction(tx, { signers: [keypair], commitment: 'confirmed' });
}
