import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Conservative: only match on variables named `keypair` or `signer` to
  // avoid false positives on unrelated objects that happen to have .publicKey
  const publicKeyMatches = rootNode.findAll({
    rule: {
      any: [
        { pattern: "keypair.publicKey" },
        { pattern: "signer.publicKey" },
        { pattern: "payer.publicKey" },
        { pattern: "wallet.publicKey" },
      ],
    },
  });

  const secretKeyMatches = rootNode.findAll({
    rule: {
      any: [
        { pattern: "keypair.secretKey" },
        { pattern: "signer.secretKey" },
      ],
    },
  });

  if (publicKeyMatches.length === 0 && secretKeyMatches.length === 0)
    return null;

  const edits = [
    ...publicKeyMatches.map((node) => {
      const text = node.text();
      return node.replace(text.replace(".publicKey", ".address"));
    }),
    ...secretKeyMatches.map((node) => {
      const text = node.text();
      return node.replace(text.replace(".secretKey", ".privateKey"));
    }),
  ];

  return rootNode.commitEdits(edits);
};

export default transform;
