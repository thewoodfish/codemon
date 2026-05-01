import { getTransferSolInstruction } from '@solana-program/system';
import {  } from '@solana/kit';

const ix = getTransferSolInstruction({
  source: sender,
  destination: recipient,
  amount: 1000000,
});
