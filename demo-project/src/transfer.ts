// ─── IMPORTS ────────────────────────────────────────────────────────────────
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';

// ─── CONNECTION ─────────────────────────────────────────────────────────────
const connection = new Connection(clusterApiUrl('devnet'));

// ─── PUBLIC KEY ─────────────────────────────────────────────────────────────
const recipient = new PublicKey('So11111111111111111111111111111111111111112');

// ─── TYPE ANNOTATIONS ───────────────────────────────────────────────────────
function printKey(key: PublicKey): void {
  console.log('key:', key.toBase58());
}

function showSigner(signer: Keypair): void {
  console.log('signer pubkey:', signer.publicKey.toBase58());
}

// ─── KEYPAIR + TRANSACTION ───────────────────────────────────────────────────
async function sendSol(): Promise<void> {
  const payer = Keypair.generate();

  const payerAddress = payer.publicKey;
  const payerSecret  = payer.secretKey;
  console.log('payer:', payerAddress, payerSecret);

  // ─── SYSTEM TRANSFER ──────────────────────────────────────────────────────
  const instruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: recipient,
    lamports: LAMPORTS_PER_SOL,
  });

  // ─── SEND AND CONFIRM ─────────────────────────────────────────────────────
  const tx = new Transaction().add(instruction);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('Transfer confirmed:', sig);
}

// ─── RPC CALL ────────────────────────────────────────────────────────────────
async function checkBalance(pubkey: PublicKey): Promise<void> {
  const balance = await connection.getBalance(pubkey);
  console.log('Balance (lamports):', balance);
}

sendSol().catch(console.error);
