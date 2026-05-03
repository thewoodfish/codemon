# solana-web3js-to-kit

Automatically migrate your codebase from `@solana/web3.js` v1 to `@solana/kit`.

```bash
git clone https://github.com/thewoodfish/codemon
bash codemon/solana-web3js-to-kit/migrate.sh ./path/to/your/project
```

---

## What It Does

**10 deterministic transforms. ~85% automation coverage. Zero false positives.**

| Transform | What changes |
|---|---|
| `01-imports` | `@solana/web3.js` → `@solana/kit` named imports |
| `02-connection` | `new Connection(url)` → `createSolanaRpc(url)` |
| `03-publickey` | `new PublicKey('str')` → `address('str')` |
| `04-keypair-generate` | `Keypair.generate()` → `await generateKeyPairSigner()` |
| `05-keypair-props` | `.publicKey` → `.address`, `.secretKey` → `.privateKey` |
| `06-system-transfer` | `SystemProgram.transfer({...})` → `getTransferSolInstruction({...})` |
| `07-send-confirm` | `sendAndConfirmTransaction(conn, tx, [s])` → kit signature |
| `08-cluster-api-url` | `clusterApiUrl('devnet')` → `'https://api.devnet.solana.com'` |
| `09-rpc-send` | `rpc.getBalance()` → `rpc.getBalance().send()` (all 40+ RPC methods) |
| `10-type-annotations` | `PublicKey`, `Keypair`, `TransactionInstruction` type annotations → kit equivalents |

---

## Before / After

**Before:**

```typescript
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function transfer(payer: Keypair, to: PublicKey) {
  const connection = new Connection(clusterApiUrl('devnet'));
  const ix = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: to,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });
  const balance = await connection.getBalance(payer.publicKey);
}
```

**After:**

```typescript
import { getTransferSolInstruction } from '@solana-program/system';
import { createSolanaRpc, address, generateKeyPairSigner, LAMPORTS_PER_SOL } from '@solana/kit';
import type { Address, KeyPairSigner } from '@solana/kit';

async function transfer(payer: KeyPairSigner, to: Address) {
  const connection = createSolanaRpc('https://api.devnet.solana.com');
  const ix = getTransferSolInstruction({
    source: payer.address,
    destination: to,
    amount: 0.1 * LAMPORTS_PER_SOL,
  });
  const balance = await connection.getBalance(payer.address).send();
}
```

---

## What Requires Manual Review

These patterns are intentionally left for human review:

- `Keypair.fromSecretKey(bytes)` → use `createKeyPairSignerFromBytes()`
- `new PublicKey(buffer)` → non-string PublicKey construction
- Multi-instruction `Transaction.add().add()` chains → rewrite to `pipe()` pattern
- Commitment level configuration → must move to per-call options
- `sendAndConfirmTransactionFactory` wiring → requires `rpc` + `rpcSubscriptions` in scope

---

## Running Individual Transforms

```bash
npx codemod jssg run --language tsx \
  ./solana-web3js-to-kit/transforms/01-imports.ts \
  --target ./your/project --no-interactive --allow-dirty
```

Transforms are numbered — run them in order (01 → 10) if applying manually.

---

## Tests

24 test fixtures across all 10 transforms. All passing.

```bash
cd solana-web3js-to-kit
npx codemod jssg test --language tsx transforms/01-imports.ts tests/01-imports
```

---

Registry: [app.codemod.com/registry/solana-web3js-to-kit](https://app.codemod.com/registry/solana-web3js-to-kit)

Case study: [Automating the @solana/web3.js v1 → @solana/kit Migration with a Codemod](https://dev.to/thewoodfish/automating-the-solanaweb3js-v1-solanakit-migration-with-a-codemod-3535)

Source: [github.com/thewoodfish/codemon](https://github.com/thewoodfish/codemon)
