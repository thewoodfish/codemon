import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Match new Connection(url) and new Connection(url, commitment)
  const matches = rootNode.findAll({
    rule: {
      any: [
        { pattern: "new Connection($URL)" },
        { pattern: "new Connection($URL, $COMMITMENT)" },
      ],
    },
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    const urlNode = node.getMatch("URL");
    if (!urlNode) return null;
    const url = urlNode.text();
    // commitment arg is intentionally dropped — kit handles it per-call
    return node.replace(`createSolanaRpc(${url})`);
  });

  const validEdits = edits.filter(Boolean) as NonNullable<
    (typeof edits)[number]
  >[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
