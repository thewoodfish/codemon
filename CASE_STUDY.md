# Automating the @solana/web3.js v1 → @solana/kit Migration with a Codemod

The Solana ecosystem moved from `@solana/web3.js` v1 to the new `@solana/kit` package,
and the migration is non-trivial. The API surface changed fundamentally: classes became
factory functions, the `Transaction` builder became a functional pipe, `PublicKey`
became a branded `Address` string, and `Keypair` became an async `KeyPairSigner`. Every
RPC call now also requires a `.send()` invocation. If you have hundreds of files using
the old API, you don't want to do this by hand.

This post walks through the codemod I built to automate the mechanical parts of the
migration, what it handles, what it deliberately skips, and how to run it on your own
codebase.

Published: https://dev.to/thewoodfish/automating-the-solanaweb3js-v1-solanakit-migration-with-a-codemod-3535

---

## What Was Migrated

I tested the codemod against 60 TypeScript files from
[`solana-developers/program-examples`](https://github.com/solana-developers/program-examples)
(the `basics/` directory), covering connection setup, key generation, address
construction, SOL transfers, RPC calls, type annotations, and transaction submission.
Zero false positives confirmed across all 60 files.

The real-repo test caught one critical issue before submission: `client` as a baseline
RPC variable name would have incorrectly appended `.send()` to `BanksClient` methods in
test files — it was removed from the detection list as a result.

Automation coverage: **~85% of call-site changes** handled deterministically across
10 transforms. The remaining ~15% are patterns where a wrong guess causes a runtime
error, so they are left with TODO comments for manual cleanup.

---

## What the Codemod Handles (10 Transforms)

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
| `09-rpc-send` | `rpc.getBalance()`, `rpc.getSlot()`, etc. → add `.send()` (40+ methods) |
| `10-type-annotations` | `PublicKey`, `Keypair`, `TransactionInstruction` types → kit equivalents |

### 1. Import Remapping

The foundation. Every other transform depends on the imports being right first.

```diff
- import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
+ import { getTransferSolInstruction } from '@solana-program/system';
+ import { createSolanaRpc, address, generateKeyPairSigner, LAMPORTS_PER_SOL, sendAndConfirmTransactionFactory } from '@solana/kit';
+ import type { Address, KeyPairSigner } from '@solana/kit';
```

Each v1 named import is remapped to its kit equivalent. `SystemProgram` is dropped from
the `@solana/kit` import since `getTransferSolInstruction` lives in
`@solana-program/system` — that import is injected by transform #6.

### 2. clusterApiUrl() → Literal URL

Resolves the three known cluster names (`devnet`, `mainnet-beta`, `testnet`) to their
literal URL strings. Runs before the Connection transform.

### 3. Connection → createSolanaRpc

```diff
- const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
+ const connection = createSolanaRpc('https://api.devnet.solana.com');
```

The commitment argument is deliberately dropped — kit handles commitment per-call, not
per-connection.

### 4. PublicKey → address

```diff
- const toPubkey = new PublicKey('So11111111111111111111111111111111111111112');
+ const toPubkey = address('So11111111111111111111111111111111111111112');
```

Only string-literal arguments are transformed. `new PublicKey(someBuffer)` is left
untouched to prevent false positives — the buffer origin needs human context.

### 5. Keypair.generate() → generateKeyPairSigner()

```diff
  async function main() {
-   const payer = Keypair.generate();
+   const payer = await generateKeyPairSigner();
  }
```

The transform checks that the enclosing function is `async` before rewriting. If the
function is synchronous, the call is left alone — introducing `await` into a sync
function would be a breaking change.

### 6. Keypair Property Access

```diff
- console.log(payer.publicKey);
- const secret = payer.secretKey;
+ console.log(payer.address);
+ const secret = payer.privateKey;
```

Applied only on discovered keypair variables through assignments and type annotations,
to avoid collisions with unrelated objects that happen to have a `.publicKey` property.

### 7. SystemProgram.transfer → getTransferSolInstruction

```diff
+ import { getTransferSolInstruction } from '@solana-program/system';

- const ix = SystemProgram.transfer({
-   fromPubkey: payer.publicKey,
-   toPubkey: recipient,
-   lamports: amount * LAMPORTS_PER_SOL,
- });
+ const ix = getTransferSolInstruction({
+   source: payer.address,
+   destination: recipient,
+   amount: amount * LAMPORTS_PER_SOL,
+ });
```

Argument keys are remapped and the `@solana-program/system` import is injected if not
already present.

### 8. sendAndConfirmTransaction (Simple Case)

```diff
- const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
+ const sig = await /* TODO: create via sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) */ sendAndConfirmTransaction(tx, { signers: [payer], commitment: 'confirmed' });
```

The simple three-argument form is rewritten to the kit signature with a TODO comment
flagging that the factory wiring still needs to be done manually.

### 9. RPC Method Calls → Add .send()

Covers all 40+ RPC methods. The transform is idempotent — it won't double-add `.send()`
on a file that's already been migrated.

### 10. Type Annotations

Targets type identifiers specifically and injects matching `import type` statements for
`Address`, `IInstruction`, and `KeyPairSigner`.

---

## What Required Manual Work

These patterns were intentionally skipped:

| Pattern | Why |
|---|---|
| `Keypair.fromSecretKey(bytes)` | Needs `createKeyPairSignerFromBytes()` but the bytes source may need async handling |
| `new PublicKey(buffer)` | Buffer-to-address conversion is non-trivial and context-dependent |
| Multi-instruction `Transaction.add().add()` chains | The functional `pipe()` rewrite is too structurally different to produce safely |
| Commitment levels | Must be moved to individual RPC call options; requires understanding each call site |
| `sendAndConfirmTransactionFactory` wiring | Requires knowing both `rpc` and `rpcSubscriptions` in scope |

Each of these is either too risky to get wrong deterministically, or requires semantic
understanding of the surrounding code. They are best handled with a follow-up AI pass
using the patterns documented in the [@solana/kit migration guide](https://github.com/anza-xyz/kit).

---

## Before and After (Full Example)

**Before:**

```typescript
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function transferSol(payer: Keypair, toAddress: string, amountSol: number): Promise<PublicKey> {
  const connection = new Connection(clusterApiUrl('devnet'));
  const toPubkey = new PublicKey(toAddress);

  const ix = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey,
    lamports: amountSol * LAMPORTS_PER_SOL,
  });

  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance);
  return toPubkey;
}
```

**After (automated):**

```typescript
import { getTransferSolInstruction } from '@solana-program/system';
import { createSolanaRpc, address, generateKeyPairSigner,
         LAMPORTS_PER_SOL, sendAndConfirmTransactionFactory } from '@solana/kit';
import type { Address, KeyPairSigner } from '@solana/kit';

async function transferSol(payer: KeyPairSigner, toAddress: string, amountSol: number): Promise<Address> {
  const connection = createSolanaRpc('https://api.devnet.solana.com');
  const toPubkey = address(toAddress);

  const ix = getTransferSolInstruction({
    source: payer.address,
    destination: toPubkey,
    amount: amountSol * LAMPORTS_PER_SOL,
  });

  const balance = await connection.getBalance(payer.address).send();
  console.log('Balance:', balance);
  return toPubkey;
}
```

All nine changes were made automatically.

---

## How to Run It

```bash
# Via the codemod registry
npx codemod run @thewoodfish/solana-web3js-to-kit --target ./path/to/your/project

# Or clone and run the shell script directly
git clone https://github.com/thewoodfish/codemon
bash codemon/solana-web3js-to-kit/migrate.sh ./path/to/your/project
```

To run individual transforms:

```bash
npx codemod jssg run --language tsx \
  ./solana-web3js-to-kit/transforms/01-imports.ts \
  --target ./your/project --no-interactive --allow-dirty
```

Transforms are numbered — run them in order (01 → 10) if applying manually.

---

## Design Decisions

**Zero false positives over maximum coverage.** Every transform has a bail-early check:
if the pattern isn't present in the file, it returns `null` and the file is untouched.
Non-string `PublicKey` construction, sync functions calling `Keypair.generate()`, and
any ambiguous property access are all skipped rather than guessed.

**No jscodeshift.** The entire codemod uses `ast-grep` (jssg), the Codemod platform's
native engine. Patterns are expressed as AST templates rather than manual tree traversal,
which makes them readable and auditable.

**Leave comments, not broken code.** Where a partial transform is applied, the output
compiles and the TODO comment points exactly at what still needs doing. A broken file
after a codemod run is worse than an unchanged one.

**Idempotency.** Every transform is safe to run multiple times — two-pass position
tracking guarantees no call gets duplicated (e.g. no double `.send()`).

---

Registry: https://app.codemod.com/registry/solana-web3js-to-kit

Source: https://github.com/thewoodfish/codemon under `solana-web3js-to-kit/`
