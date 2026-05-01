import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

// Only type identifiers that map 1:1 without introducing generics or extra imports
const TYPE_MAP: Record<string, string> = {
  PublicKey: "Address",
  Keypair: "KeyPairSigner",
  TransactionInstruction: "IInstruction",
};

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();
  const edits: ReturnType<typeof rootNode.find>[] = [];
  const addedTypes = new Set<string>();

  for (const [v1Type, kitType] of Object.entries(TYPE_MAP)) {
    rootNode
      .findAll({
        rule: {
          all: [{ kind: "type_identifier" }, { regex: `^${v1Type}$` }],
        },
      })
      .forEach((m) => {
        edits.push(m.replace(kitType));
        addedTypes.add(kitType);
      });
  }

  if (edits.length === 0) return null;

  // Inject `import type { ... } from '@solana/kit'` unless already present
  const alreadyHasTypeImport = rootNode.find({
    rule: { pattern: `import type { $$$  } from '@solana/kit'` },
  });

  if (!alreadyHasTypeImport) {
    const typeImportLine = `import type { ${[...addedTypes].sort().join(", ")} } from '@solana/kit';`;

    // Prefer to insert after the existing @solana/kit value import
    const anchor =
      rootNode.find({ rule: { pattern: `import { $$$ } from '@solana/kit'` } }) ||
      rootNode.find({ rule: { kind: "import_statement" } });

    if (anchor) {
      edits.push(anchor.replace(`${anchor.text()}\n${typeImportLine}`));
    }
  }

  return rootNode.commitEdits(edits as Parameters<typeof rootNode.commitEdits>[0]);
};

export default transform;
