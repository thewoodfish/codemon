import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const SPECIFIER_MAP: Record<string, string[]> = {
  Connection: ["createSolanaRpc", "createSolanaRpcSubscriptions"],
  PublicKey: ["address"],
  Keypair: ["generateKeyPairSigner"],
  Transaction: ["createTransactionMessage", "pipe"],
  // SystemProgram → getTransferSolInstruction from @solana-program/system (handled by 06-system-transfer.ts)
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
    const text = node.text();

    // Extract the specifier block between { and }
    const braceMatch = text.match(/import\s*\{([^}]+)\}/);
    if (!braceMatch) return null;

    const originalSpecifiers = braceMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const kitSpecifiers: string[] = [];
    for (const spec of originalSpecifiers) {
      const baseName = spec.split(/\s+as\s+/)[0].trim();
      const mapped = SPECIFIER_MAP[baseName];
      if (mapped) {
        kitSpecifiers.push(...mapped);
      } else {
        kitSpecifiers.push(spec);
      }
    }

    const deduped = [...new Set(kitSpecifiers)];
    return node.replace(`import { ${deduped.join(", ")} } from '@solana/kit';`);
  });

  const validEdits = edits.filter(Boolean) as NonNullable<(typeof edits)[number]>[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
