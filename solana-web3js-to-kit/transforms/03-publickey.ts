import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const allMatches = rootNode.findAll({
    rule: { pattern: "new PublicKey($STR)" },
  });

  const defaultMatches = rootNode.findAll({
    rule: { pattern: "PublicKey.default" },
  });

  if (allMatches.length === 0 && defaultMatches.length === 0) return null;

  const edits = [
    ...allMatches.map((node) => {
      const strNode = node.getMatch("STR");
      if (!strNode) return null;
      // Only transform string literals — skip buffer/variable args to avoid false positives
      const kind = strNode.kind();
      if (kind !== "string" && kind !== "template_string") return null;
      return node.replace(`address(${strNode.text()})`);
    }),
    ...defaultMatches.map((node) =>
      node.replace(`address('11111111111111111111111111111111')`)
    ),
  ];

  const validEdits = edits.filter(Boolean) as NonNullable<(typeof edits)[number]>[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
