---
title: Automating the @solana/web3.js v1 → @solana/kit Migration with a Codemod
published: true
tags: solana, typescript, codemod, web3
---

The Solana ecosystem moved from `@solana/web3.js` v1 to the new `@solana/kit` package, and the migration is non-trivial. Classes became factory functions, `Transaction` building became a functional pipe, `PublicKey` became a branded `Address` string, and `Keypair` became an async `KeyPairSigner`. Oh, and every RPC call now returns a `RpcRequest` that needs `.send()` before it does anything.

If you have hundreds of files using the old API, you don't want to do this by hand.

This post walks through the codemod I built to automate the mechanical parts of the migration, what it handles, what it deliberately skips, and how to run it on your own codebase.

---

## Automation Coverage

**~85% of call-site changes handled deterministically** across 10 transforms. Here's the breakdown:

| Pattern | Status |
|---|---|
| `import ... from '@solana/web3.js'` | ✅ Automated |
| `clusterApiUrl('devnet')` → literal URL | ✅ Automated |
| `new Connection(url)` → `createSolanaRpc(url)` | ✅ Automated |
| `new PublicKey('string')` → `address('string')` | ✅ Automated |
| `Keypair.generate()` → `await generateKeyPairSigner()` | ✅ Automated (async functions only) |
| `.publicKey` → `.address`, `.secretKey` → `.privateKey` | ✅ Automated |
| `SystemProgram.transfer({...})` → `getTransferSolInstruction({...})` | ✅ Automated |
| `sendAndConfirmTransaction(conn, tx, [signer])` → kit signature | ✅ Automated |
| `rpc.getBalance()`, `rpc.getSlot()`, etc. → add `.send()` | ✅ Automated |
| `PublicKey`, `Keypair`, `TransactionInstruction` type annotations | ✅ Automated |
| `Keypair.fromSecretKey(bytes)` | ⚠️ Manual |
| `new PublicKey(buffer)` | ⚠️ Manual |
| Multi-instruction `Transaction.add().add()` chains | ⚠️ Manual |
| Commitment level configuration | ⚠️ Manual |
| `sendAndConfirmTransactionFactory` wiring | ⚠️ Manual |

The manual patterns are skipped intentionally — not because they're hard, but because getting them wrong silently (wrong variable name, missing `await`, broken transaction structure) is worse than leaving them for a human to fix with full context.

---

## What the Codemod Handles (10 Transforms)

### 1. Import Remapping

The foundation — every other transform depends on imports being right first.

```diff
- import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
+ import { createSolanaRpc, createSolanaRpcSubscriptions, address, generateKeyPairSigner, LAMPORTS_PER_SOL, sendAndConfirmTransactionFactory } from '@solana/kit';
```

Each v1 named import is remapped to its kit equivalent. `SystemProgram` is dropped here since `getTransferSolInstruction` lives in `@solana-program/system` — that import is injected by transform #6.

### 2. clusterApiUrl() → literal URL

```diff
- const connection = new Connection(clusterApiUrl('devnet'));
+ const connection = new Connection('https://api.devnet.solana.com');
```

Resolves the three known cluster names (`devnet`, `mainnet-beta`, `testnet`) to their literal URL strings. This runs before the Connection transform so `02-connection` sees a clean URL.

### 3. Connection → createSolanaRpc

```diff
- const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
+ const connection = createSolanaRpc('https://api.devnet.solana.com');
```

The commitment argument is deliberately dropped — kit handles commitment per-call, not per-connection. This is flagged in the manual step.

### 4. PublicKey → address

```diff
- const toPubkey = new PublicKey('So11111111111111111111111111111111111111112');
- const systemKey = PublicKey.default;
+ const toPubkey = address('So11111111111111111111111111111111111111112');
+ const systemKey = address('11111111111111111111111111111111');
```

Only string-literal arguments are transformed. `new PublicKey(someBuffer)` is left untouched to prevent false positives — the buffer origin needs human context.

### 5. Keypair.generate() → generateKeyPairSigner()

```diff
  async function main() {
-   const payer = Keypair.generate();
+   const payer = await generateKeyPairSigner();
  }
```

The transform checks that the enclosing function is `async` before rewriting. If the function is synchronous, the call is left alone — introducing `await` into a sync function would be a breaking change.

### 6. Keypair Property Access

```diff
- console.log(payer.publicKey);
- const secret = payer.secretKey;
+ console.log(payer.address);
+ const secret = payer.privateKey;
```

Applied only on variables discovered to be keypairs — via assignments (`Keypair.generate()`, `generateKeyPairSigner()`) and type annotations (`payer: Keypair`, `signer: KeyPairSigner`), plus a conservative baseline list of common names. No `.publicKey` on unrelated objects gets touched.

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

Argument keys are remapped (`fromPubkey→source`, `toPubkey→destination`, `lamports→amount`) and the `@solana-program/system` import is injected if not already present.

### 8. sendAndConfirmTransaction (Simple Case)

```diff
- const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
+ const sig = await sendAndConfirmTransaction(tx, { signers: [payer], commitment: 'confirmed' });
```

The simple three-argument form is rewritten to the kit call signature. The output includes an inline comment reminding you to wire up `sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })` — this requires knowing both variables in scope, which is context the transform can't safely infer.

### 9. RPC Method Calls → Add .send()

```diff
- const balance = await rpc.getBalance(pubkey);
- const slot = await rpc.getSlot();
+ const balance = await rpc.getBalance(pubkey).send();
+ const slot = await rpc.getSlot().send();
```

In `@solana/kit`, every RPC method returns a `RpcRequest` — you have to call `.send()` on it to actually execute the request. This transform covers all 40+ RPC methods and is idempotent: running it twice won't double the `.send()`.

### 10. Type Annotations

```diff
- function transfer(from: Keypair, to: PublicKey): Promise<TransactionInstruction> {
+ function transfer(from: KeyPairSigner, to: Address): Promise<IInstruction> {
```

Targets `type_identifier` AST nodes specifically — so `new PublicKey(...)` (already handled by transform #4) and `import { Keypair }` (handled by transform #1) are never touched twice. Also injects the matching `import type { Address, IInstruction, KeyPairSigner } from '@solana/kit'` automatically.

---

## What Required Manual Work

These patterns were intentionally skipped:

| Pattern | Why |
|---|---|
| `Keypair.fromSecretKey(bytes)` | Needs `createKeyPairSignerFromBytes()` but the bytes source may need async handling |
| `new PublicKey(buffer)` | Buffer-to-address conversion is context-dependent |
| Multi-instruction `Transaction.add().add()` chains | The functional `pipe()` rewrite is too structurally different to produce safely |
| Commitment levels | Must be moved to individual RPC call options |
| `sendAndConfirmTransactionFactory` wiring | Requires knowing both `rpc` and `rpcSubscriptions` in scope |

Each of these is either too risky to get wrong deterministically, or requires semantic understanding of the surrounding code. They are best handled with a follow-up AI pass using the patterns documented in the [@solana/kit migration guide](https://github.com/anza-xyz/kit).

---

## Before and After (Full Example)

**Before:**

```typescript
import { Connection, PublicKey, Keypair, SystemProgram,
         LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';

async function transferSol(payer: Keypair, toAddress: string, amountSol: number): Promise<PublicKey> {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
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

All nine changes in this example were made automatically.

---

## How to Run It

```bash
# Via the shell script (most reliable)
git clone https://github.com/thewoodfish/codemon
bash codemon/solana-web3js-to-kit/migrate.sh ./path/to/your/project

# Or run individual transforms via the codemod CLI
npx codemod jssg run --language tsx \
  ./solana-web3js-to-kit/transforms/01-imports.ts \
  --target ./your/project --no-interactive --allow-dirty
```

---

## Design Decisions

**Zero false positives over maximum coverage.** Every transform has a bail-early check: if the pattern isn't present in the file, it returns `null` and the file is untouched. Non-string `PublicKey` construction, sync functions calling `Keypair.generate()`, and ambiguous `.publicKey` accesses are all skipped rather than guessed.

**No jscodeshift.** The entire codemod uses `ast-grep` (jssg), the Codemod platform's native engine. Patterns are expressed as AST templates rather than manual tree traversal, making them readable and auditable.

**Leave comments, not broken code.** Where a partial transform is applied, the output still compiles and an inline comment points exactly at what still needs doing. A broken file after a codemod run is worse than an unchanged one.

**Idempotency.** Every transform is safe to run multiple times. The RPC `.send()` transform uses two-pass position tracking to guarantee no call ever gets doubled.

---

Source: [github.com/thewoodfish/codemon](https://github.com/thewoodfish/codemon) under `solana-web3js-to-kit/`.
