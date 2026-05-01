# Demo Script — solana-web3js-to-kit (~2 min)

---

**[INTRO — 15s]**

The Solana JavaScript SDK was recently rewritten from scratch.
If you have any existing Solana project, you're facing a migration from
`@solana/web3.js` v1 to `@solana/kit` — and it is not a small change.
Imports, connections, keypairs, public keys, transactions, RPC calls —
almost everything changed. Doing it by hand across hundreds of files
takes days, and one wrong change gives you a silent runtime bug.

---

**[SHOW THE PROBLEM — 20s]**

Here's a typical web3.js v1 file.
*(show input file — imports, new Connection, Keypair.generate, new PublicKey, SystemProgram.transfer, getBalance)*

You can see: old imports, class-based API, no `.send()` on RPC calls,
wrong argument names on the transfer instruction.
To migrate this manually you'd touch every single line.

---

**[RUN THE CODEMOD — 30s]**

Instead, I run one command:

```bash
bash migrate.sh ./my-solana-project
```

Ten transforms run in sequence — each one handling a specific pattern.
Imports, connections, keypairs, public keys, property renames,
system program calls, RPC signatures, type annotations — all of it.

*(show terminal output — 10 transforms completing one by one)*

Done. Less than a second.

---

**[SHOW THE RESULT — 25s]**

*(show the diff)*

Imports rewritten to `@solana/kit`.
`new Connection` is now `createSolanaRpc`.
`Keypair.generate()` is `await generateKeyPairSigner()`.
`new PublicKey` is `address()`.
`SystemProgram.transfer` with the old argument names is now
`getTransferSolInstruction` with the correct ones.
And every RPC call has `.send()` — the most common runtime bug in migrations, caught automatically.
Type annotations updated too.

---

**[ACCURACY — 15s]**

The codemod was tested against 60 real TypeScript files from
`solana-developers/program-examples` — zero false positives.
Every transform bails early rather than guessing wrong.
The 15% it doesn't touch is left with clear inline comments
so an AI agent or a developer knows exactly what to fix next.

---

**[CLOSE — 15s]**

10 transforms. 24 tests. 85% automation coverage. Zero false positives.
Published on the Codemod registry — anyone can run it today with:

```bash
npx codemod solana-web3js-to-kit
```

Source at github.com/thewoodfish/codemon.

---

*Total: ~120 seconds*
