import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

// Baseline names common across the Solana ecosystem
const BASELINE_NAMES = [
  "keypair", "keyPair", "kp",
  "signer", "payer", "wallet",
  "authority", "feePayer", "sender", "owner",
];

// Assignment patterns that prove a variable holds a Keypair/signer
const ASSIGNMENT_PATTERNS = [
  "const $VAR = Keypair.generate()",
  "let $VAR = Keypair.generate()",
  "const $VAR = await generateKeyPairSigner()",
  "let $VAR = await generateKeyPairSigner()",
  "const $VAR = await createKeyPairSignerFromBytes($$$)",
  "let $VAR = await createKeyPairSignerFromBytes($$$)",
  "const $VAR = Keypair.fromSecretKey($$$)",
  "let $VAR = Keypair.fromSecretKey($$$)",
];

// Type annotation patterns that prove a parameter holds a Keypair/signer
const TYPE_PATTERNS = [
  "$VAR: Keypair",
  "$VAR: KeyPairSigner",
  "$VAR: Signer",
];

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Collect all variable names we know hold keypairs
  const names = new Set(BASELINE_NAMES);

  for (const pattern of [...ASSIGNMENT_PATTERNS, ...TYPE_PATTERNS]) {
    rootNode.findAll({ rule: { pattern } }).forEach((m) => {
      const name = m.getMatch("VAR")?.text();
      if (name) names.add(name);
    });
  }

  // Build edits for every discovered name
  const edits: ReturnType<typeof rootNode.find>[] = [];

  for (const name of names) {
    rootNode
      .findAll({ rule: { pattern: `${name}.publicKey` } })
      .forEach((m) => edits.push(m.replace(`${name}.address`)));

    rootNode
      .findAll({ rule: { pattern: `${name}.secretKey` } })
      .forEach((m) => edits.push(m.replace(`${name}.privateKey`)));
  }

  if (edits.length === 0) return null;

  return rootNode.commitEdits(edits as Parameters<typeof rootNode.commitEdits>[0]);
};

export default transform;
