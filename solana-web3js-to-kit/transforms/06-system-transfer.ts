import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const matches = rootNode.findAll({
    rule: { pattern: "SystemProgram.transfer($ARGS)" },
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    const argsNode = node.getMatch("ARGS");
    if (!argsNode) return null;
    const argsText = argsNode.text();

    // Remap known argument keys: fromPubkey→source, toPubkey→destination, lamports→amount
    const remapped = argsText
      .replace(/\bfromPubkey\s*:/g, "source:")
      .replace(/\btoPubkey\s*:/g, "destination:")
      .replace(/\blamports\s*:/g, "amount:");

    return node.replace(`getTransferSolInstruction(${remapped})`);
  });

  const validEdits = edits.filter(Boolean) as NonNullable<
    (typeof edits)[number]
  >[];
  if (validEdits.length === 0) return null;

  // Also need to inject the @solana-program/system import if not present.
  // We do a best-effort check: if the import is already there, skip.
  const hasSystemImport = rootNode
    .findAll({
      rule: { pattern: "import { $$$X } from '@solana-program/system'" },
    })
    .some(() => true);

  const result = rootNode.commitEdits(validEdits);

  if (!hasSystemImport && result) {
    // Prepend import at the top of the file.
    // Find first import declaration to insert before it, or insert at position 0.
    const firstImport = rootNode.find({ rule: { kind: "import_statement" } });
    if (firstImport) {
      const insertEdit = firstImport.replace(
        `import { getTransferSolInstruction } from '@solana-program/system';\n${firstImport.text()}`
      );
      return rootNode.commitEdits([...validEdits, insertEdit]);
    }
  }

  return result;
};

export default transform;
