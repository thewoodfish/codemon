import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Match the simple case: sendAndConfirmTransaction(connection, tx, [signer])
  const matches = rootNode.findAll({
    rule: {
      pattern: "sendAndConfirmTransaction($CONNECTION, $TX, [$SIGNER])",
    },
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    const txNode = node.getMatch("TX");
    const signerNode = node.getMatch("SIGNER");
    if (!txNode || !signerNode) return null;

    const tx = txNode.text();
    const signer = signerNode.text();

    // Emit a best-effort kit equivalent with a TODO comment for complex cases
    return node.replace(
      `/* TODO: create via sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) */ sendAndConfirmTransaction(${tx}, { signers: [${signer}], commitment: 'confirmed' })`
    );
  });

  const validEdits = edits.filter(Boolean) as NonNullable<
    (typeof edits)[number]
  >[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
