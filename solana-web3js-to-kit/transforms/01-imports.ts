import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const SPECIFIER_MAP: Record<string, string[]> = {
  Connection: ["createSolanaRpc", "createSolanaRpcSubscriptions"],
  PublicKey: ["address"],
  Keypair: ["generateKeyPairSigner"],
  Transaction: ["createTransactionMessage", "pipe"],
  // SystemProgram → @solana-program/system (handled by 06-system-transfer.ts)
  SystemProgram: [],
  LAMPORTS_PER_SOL: ["LAMPORTS_PER_SOL"],
  sendAndConfirmTransaction: ["sendAndConfirmTransactionFactory"],
  clusterApiUrl: ["createSolanaRpc"],
};

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const matches = rootNode.findAll({
    rule: { pattern: "import { $$$ } from '@solana/web3.js'" },
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    // Walk the AST: import_statement → named_imports → import_specifier[]
    const namedImports = node.find({ rule: { kind: "named_imports" } });
    if (!namedImports) return null;

    const specifiers = namedImports.findAll({ rule: { kind: "import_specifier" } });

    const kitSpecifiers: string[] = [];
    for (const spec of specifiers) {
      // For "Connection" → first identifier is "Connection"
      // For "PublicKey as PK" → first identifier is "PublicKey" (not the alias)
      const nameNode = spec.find({ rule: { kind: "identifier" } });
      const importedName = nameNode?.text();
      if (!importedName) continue;

      const mapped = SPECIFIER_MAP[importedName];
      if (mapped !== undefined) {
        kitSpecifiers.push(...mapped);
      } else {
        kitSpecifiers.push(importedName);
      }
    }

    const deduped = [...new Set(kitSpecifiers)].filter((s) => s.length > 0);
    if (deduped.length === 0) return null;

    return node.replace(`import { ${deduped.join(", ")} } from '@solana/kit';`);
  });

  const validEdits = edits.filter(Boolean) as NonNullable<(typeof edits)[number]>[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
