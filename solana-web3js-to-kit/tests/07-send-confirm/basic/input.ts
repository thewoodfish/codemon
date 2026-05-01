async function send() {
  await sendAndConfirmTransaction(connection, tx, [keypair]);
}
