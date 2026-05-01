import { getTransferSolInstruction } from '@solana-program/system';

const ix = getTransferSolInstruction({
  source: sender,
  destination: recipient,
  amount: 1000000,
});
