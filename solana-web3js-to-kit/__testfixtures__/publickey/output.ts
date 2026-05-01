import { address } from '@solana/kit';

const pk = address('So11111111111111111111111111111111111111112');
const systemPk = address('11111111111111111111111111111111');
// This should NOT be transformed (non-string arg)
const fromBuffer = new PublicKey(someBuffer);
