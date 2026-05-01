# CLAUDE.md — @solana/web3.js v1 → @solana/kit Codemod

## Project Goal

Build a production-grade codemod that automatically migrates TypeScript/JavaScript
codebases from `@solana/web3.js` v1 to `@solana/kit`. Submit to the Boring AI
hackathon on DoraHacks before May 3, 2026 at 13:00 UTC.

Target prize tier: **L ($400)** for the migration recipe + **$200** case study.

---

## Critical Rules

- **NEVER use jscodeshift.** The platform explicitly forbids it. Use jssg only.
- Use `import type { Transform } from "codemod:ast-grep"` for all transforms.
- Every transform must return `null` if no changes are needed (bail early).
- Zero false positives is the top scoring criterion. When in doubt, skip the
  transform and leave it for the AI step.
- Test every pattern on a real open-source Solana repo before submitting.

---

## Toolchain Setup

```bash
# Scaffold the codemod package
npx codemod init solana-web3js-to-kit
cd solana-web3js-to-kit

# When prompted: pick JavaScript ast-grep (jssg) codemod type

# Install deps
npm install

# Run tests
npx codemod workflow run -w workflow.yaml

# Publish when ready
npx codemod publish
```

Use Codemod Studio (https://codemod.com/studio) to:
- Explore AST node kinds for any pattern you're unsure about
- Paste sample v1 code and inspect the tree before writing a rule
- Test transforms visually before coding them

---

## Migration Map: v1 → kit

This is the master reference. Implement transforms top-down, easiest first.

### 1. Package Import (HIGHEST PRIORITY — do this first)

```typescript
// v1
import { Connection, PublicKey, Keypair, Transaction, ... } from '@solana/web3.js';

// kit
import { createSolanaRpc, address, generateKeyPairSigner, ... } from '@solana/kit';
```

The import rewrite is the foundation. Every other transform depends on it.
Named imports change; the package name changes. This is a straightforward
AST rewrite — find `ImportDeclaration` with source `@solana/web3.js`, rewrite
source to `@solana/kit`, and remap specifiers per the table below.

**Specifier mapping:**

| v1 import | kit import |
|---|---|
| `Connection` | `createSolanaRpc`, `createSolanaRpcSubscriptions` |
| `PublicKey` | `address` (type: `Address`) |
| `Keypair` | `generateKeyPairSigner`, `KeyPairSigner` |
| `Transaction` | `createTransactionMessage`, `pipe` |
| `SystemProgram` | `getTransferSolInstruction` (from `@solana-program/system`) |
| `LAMPORTS_PER_SOL` | `LAMPORTS_PER_SOL` (still exported from `@solana/kit`) |
| `sendAndConfirmTransaction` | `sendAndConfirmTransactionFactory` |
| `clusterApiUrl` | `createSolanaRpc` with direct URL string |

### 2. Connection Instantiation

```typescript
// v1
const connection = new Connection(rpcUrl);
const connection = new Connection(rpcUrl, 'confirmed');
const connection = new Connection(clusterApiUrl('devnet'));

// kit
const rpc = createSolanaRpc(rpcUrl);
const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
```

Pattern: find `new Connection($URL)` and `new Connection($URL, $COMMITMENT)`.
Replace with `createSolanaRpc($URL)`. Flag the commitment level for AI handling
since kit handles commitment differently per-call.

### 3. PublicKey Construction

```typescript
// v1
const pk = new PublicKey('ABC123...');
const pk = new PublicKey(buffer);
const pk = PublicKey.default;

// kit
const pk = address('ABC123...');
// Buffer case: leave for AI — not directly automatable
// PublicKey.default → address('11111111111111111111111111111111')
```

Pattern: find `new PublicKey($STR)` where `$STR` is a string literal.
Replace with `address($STR)`. Skip non-string arguments (leave for AI).

### 4. Keypair Generation

```typescript
// v1
const keypair = Keypair.generate();
const keypair = Keypair.fromSecretKey(secretKey);

// kit
const keypair = await generateKeyPairSigner();
// fromSecretKey case: leave for AI
```

Pattern: find `Keypair.generate()`. Replace with `await generateKeyPairSigner()`.
Note: this introduces `await` — the containing function must be async.
Check if containing function is async before transforming; if not, flag for AI.

### 5. Keypair Property Access

```typescript
// v1
keypair.publicKey      // → keypair.address
keypair.secretKey      // → keypair.privateKey

// kit
keypair.address
keypair.privateKey
```

Pattern: find `MemberExpression` with property `publicKey` on a known keypair
variable. Replace with `.address`. Same for `secretKey` → `privateKey`.
Only transform when the object is typed as `Keypair` (conservative — skip
ambiguous cases to avoid false positives).

### 6. Amount Literals (BigInt)

```typescript
// v1
const amount = 1000000;
const amount = LAMPORTS_PER_SOL * 2;

// kit
const amount = 1000000n;
const amount = LAMPORTS_PER_SOL * 2n;
```

**WARNING: High false positive risk.** Only transform numeric literals that
are directly passed to known Solana functions (transfer amounts, lamport
fields). Do NOT transform all numeric literals — that will break everything.
Scope this narrowly or leave for AI.

### 7. Transaction Building

```typescript
// v1
const tx = new Transaction().add(instruction);
await sendAndConfirmTransaction(connection, tx, [keypair]);

// kit — functional pipe pattern
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const tx = pipe(
  createTransactionMessage({ version: 0 }),
  (msg) => appendTransactionMessageInstruction(instruction, msg),
  (msg) => setTransactionMessageFeePayerSigner(signer, msg),
  (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
);
await sendAndConfirmTransaction(tx, { commitment: 'confirmed' });
```

**This is the most complex transform.** The architecture changed fundamentally.
Implement a best-effort transform for the simple case (`new Transaction().add()`
with a single instruction) and leave multi-instruction and complex cases for AI.

### 8. System Program Transfers

```typescript
// v1
SystemProgram.transfer({ fromPubkey, toPubkey, lamports })

// kit
import { getTransferSolInstruction } from '@solana-program/system';
getTransferSolInstruction({ source: fromPubkey, destination: toPubkey, amount: lamports })
```

Pattern: find `SystemProgram.transfer($ARGS)`. Replace with
`getTransferSolInstruction(...)` and remap the argument keys.
Add the `@solana-program/system` import if not present.

---

## Transform Implementation Structure

Each transform lives in its own file. Structure:

```
solana-web3js-to-kit/
  transforms/
    01-imports.ts           # Package import rewrite
    02-connection.ts        # new Connection() → createSolanaRpc()
    03-publickey.ts         # new PublicKey() → address()
    04-keypair-generate.ts  # Keypair.generate() → generateKeyPairSigner()
    05-keypair-props.ts     # .publicKey → .address, .secretKey → .privateKey
    06-system-transfer.ts   # SystemProgram.transfer() → getTransferSolInstruction()
    07-send-confirm.ts      # sendAndConfirmTransaction pattern
  workflow.yaml             # Orchestrates all transforms in order
  __testfixtures__/
    imports/
      input.ts
      output.ts
    connection/
      input.ts
      output.ts
    # ... one fixture pair per transform
```

### jssg Transform Template

```typescript
import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Bail early if no relevant patterns exist
  const matches = rootNode.findAll({
    rule: { pattern: "YOUR_PATTERN_HERE" }
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    // Build replacement
    return node.replace(`REPLACEMENT_HERE`);
  });

  return rootNode.commitEdits(edits);
};

export default transform;
```

### Workflow Definition

```yaml
# workflow.yaml
version: "1"
nodes:
  - id: imports
    name: Rewrite @solana/web3.js imports to @solana/kit
    type: codemod
    codemod: ./transforms/01-imports.ts

  - id: connection
    name: Replace Connection with createSolanaRpc
    type: codemod
    codemod: ./transforms/02-connection.ts
    dependsOn: [imports]

  - id: publickey
    name: Replace new PublicKey() with address()
    type: codemod
    codemod: ./transforms/03-publickey.ts
    dependsOn: [imports]

  - id: keypair
    name: Replace Keypair.generate() with generateKeyPairSigner()
    type: codemod
    codemod: ./transforms/04-keypair-generate.ts
    dependsOn: [imports]

  - id: keypair-props
    name: Replace .publicKey/.secretKey with .address/.privateKey
    type: codemod
    codemod: ./transforms/05-keypair-props.ts
    dependsOn: [keypair]

  - id: system-transfer
    name: Replace SystemProgram.transfer with getTransferSolInstruction
    type: codemod
    codemod: ./transforms/06-system-transfer.ts
    dependsOn: [imports]

  - id: send-confirm
    name: Replace sendAndConfirmTransaction pattern
    type: codemod
    codemod: ./transforms/07-send-confirm.ts
    dependsOn: [connection, keypair]
```

---

## Testing Strategy

### Unit Tests (per transform)

Each transform needs at minimum:
- Happy path: the pattern exists and is transformed correctly
- No-op: the pattern doesn't exist, file returned unchanged
- Edge case: partial match that should NOT be transformed

### Integration Test (real repo)

Target repo for testing: **`solana-labs/solana-program-library`** or any
popular open-source Solana project using web3.js v1.

Steps:
1. Clone target repo
2. Run `npx codemod workflow run -w workflow.yaml --target ./path/to/repo`
3. Inspect diff — zero false positives required
4. Run `tsc --noEmit` on the result to check type errors
5. Document: what % of patterns were automated vs left for AI

### Scoring Self-Check

Before submitting, answer these honestly:
- [ ] Zero false positives confirmed on real repo
- [ ] All transforms bail early when pattern not present
- [ ] Tests exist and pass for every transform
- [ ] Workflow runs end-to-end without errors
- [ ] % coverage documented (target: 80%+)

---

## What to Leave for AI (Do Not Automate)

These patterns are too risky or complex for deterministic transforms:

- `Keypair.fromSecretKey(buffer)` — requires understanding buffer origin
- `new PublicKey(buffer)` — non-string PublicKey construction
- Multi-instruction Transaction building — architecture too different
- Commitment level migration — per-call, context-dependent
- `connection.getBalance()` → `rpc.getBalance()` — requires rpc variable
  to be in scope and correctly named
- Any pattern inside a conditional or ternary

For each of these, write an AI instruction comment in the workflow:

```yaml
  - id: ai-edge-cases
    name: Handle remaining edge cases
    type: ai
    prompt: |
      Complete the migration from @solana/web3.js v1 to @solana/kit for
      the remaining patterns that could not be automated:
      1. Keypair.fromSecretKey() calls
      2. new PublicKey() with non-string arguments
      3. Multi-instruction Transaction building
      4. Commitment level configuration
      Refer to the @solana/kit docs at https://github.com/anza-xyz/kit
```

---

## Case Study (write after transforms are done)

Publish to dev.to or a public GitHub gist. Structure:

1. **What was migrated** — project name, lines of code, web3.js v1 usage scope
2. **Automation coverage** — X% of patterns automated, Y patterns left for AI
3. **What the codemods handle** — list each transform
4. **What required AI/manual work** — list edge cases
5. **Before/after diff highlights** — 2-3 concrete examples
6. **How to run it** — `npx codemod @your-handle/solana-web3js-to-kit`

Target: 800–1000 words. This earns the $200 case study prize on top of the
migration recipe payout.

---

## Submission Checklist

- [ ] Codemod published to registry: `npx codemod publish`
- [ ] PR submitted to Codemod platform repo
- [ ] Tested on at least one real open-source Solana project
- [ ] Test fixtures included and passing
- [ ] workflow.yaml includes AI step for edge cases
- [ ] Case study published and linked
- [ ] DoraHacks submission before May 3 13:00 UTC
  - Project title, description, GitHub link, demo video (screen record
    of the codemod running on a real repo)
