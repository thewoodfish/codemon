# solana-web3js-to-kit — BUIDL Description

## What It Does

A production-grade codemod that automatically migrates TypeScript/JavaScript codebases from `@solana/web3.js` v1 to `@solana/kit`. Run one command, get 85% of the migration done in seconds.

```bash
bash migrate.sh ./your-solana-project
```

## The Problem

The Solana JavaScript SDK was rewritten from scratch. `@solana/web3.js` v1 — used in thousands of projects — was replaced by `@solana/kit`, a fundamentally different API:

- `new Connection(url)` → `createSolanaRpc(url)`
- `new PublicKey('...')` → `address('...')`
- `Keypair.generate()` → `await generateKeyPairSigner()`
- `SystemProgram.transfer({fromPubkey, toPubkey, lamports})` → `getTransferSolInstruction({source, destination, amount})`
- Every RPC call now returns a `RpcRequest` that requires `.send()` to execute

Doing this by hand across hundreds of files is slow, repetitive, and error-prone. A single missed `.send()` produces a silent runtime bug, not a compile error.

## The Solution

10 deterministic AST transforms using `ast-grep` (jssg) on the Codemod platform:

| Transform | What It Automates |
|---|---|
| `01-imports` | Rewrites all `@solana/web3.js` named imports to `@solana/kit` equivalents |
| `02-connection` | `new Connection(url)` → `createSolanaRpc(url)` |
| `03-publickey` | `new PublicKey('string')` → `address('string')` |
| `04-keypair-generate` | `Keypair.generate()` → `await generateKeyPairSigner()` (async-safe) |
| `05-keypair-props` | `.publicKey` → `.address`, `.secretKey` → `.privateKey` |
| `06-system-transfer` | `SystemProgram.transfer({...})` → `getTransferSolInstruction({...})` |
| `07-send-confirm` | `sendAndConfirmTransaction(conn, tx, [s])` → kit call signature |
| `08-cluster-api-url` | `clusterApiUrl('devnet')` → `'https://api.devnet.solana.com'` |
| `09-rpc-send` | Adds `.send()` to all 40+ bare RPC method calls |
| `10-type-annotations` | `PublicKey`, `Keypair`, `TransactionInstruction` types → `Address`, `KeyPairSigner`, `IInstruction` |

## Key Design Decisions

**Zero false positives over maximum coverage.** Every transform bails early if the pattern isn't present. Non-string `PublicKey` construction, sync functions calling `Keypair.generate()`, and generic variable names like `client` (which could be a `BanksClient` or HTTP client) are all skipped rather than guessed.

**Validated on a real repo.** Tested against 60 TypeScript files from `solana-developers/program-examples`. Zero false positives confirmed. The real-repo test caught one critical issue before submission: `client` as a baseline RPC name would have incorrectly added `.send()` to `BanksClient` methods in test files.

**Idempotent.** Every transform is safe to run multiple times. The RPC `.send()` transform uses two-pass position deduplication to guarantee no call is doubled.

**Leaves comments, not broken code.** Where a partial transform is applied (e.g. `sendAndConfirmTransaction`), the output still compiles and an inline comment points at what still needs doing.

## Coverage

| Category | Status |
|---|---|
| Automated (10 transforms) | ~85% of call-site changes |
| Manual / AI follow-up | ~15% (complex patterns) |

Patterns left for manual review:
- `Keypair.fromSecretKey(bytes)` — async handling depends on bytes source
- `new PublicKey(buffer)` — non-string construction is context-dependent
- Multi-instruction `Transaction.add().add()` chains — architecture too different
- Commitment level migration — per-call, context-dependent
- `sendAndConfirmTransactionFactory` wiring — requires both `rpc` + `rpcSubscriptions` in scope

## Stats

- **10 transforms**, all with test fixtures
- **24 tests**, all passing
- **60 real-world files** validated (solana-developers/program-examples/basics)
- Published on Codemod registry: `npx codemod solana-web3js-to-kit`
- Source: [github.com/thewoodfish/codemon](https://github.com/thewoodfish/codemon)
