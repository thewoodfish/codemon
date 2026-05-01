import { sendAndConfirmTransactionFactory } from '@solana/kit';

async function send() {
  /* TODO: ensure sendAndConfirmTransaction is created via sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) */ await sendAndConfirmTransaction(tx, { signers: [keypair], commitment: 'confirmed' });
}
