import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const CLUSTER_URLS: Record<string, string> = {
  "devnet": "https://api.devnet.solana.com",
  "testnet": "https://api.testnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const matches = rootNode.findAll({
    rule: { pattern: "clusterApiUrl($CLUSTER)" },
  });

  if (matches.length === 0) return null;

  const edits = matches.map((node) => {
    const clusterNode = node.getMatch("CLUSTER");
    if (!clusterNode) return null;

    // Extract the string value (strip surrounding quotes)
    const raw = clusterNode.text();
    const clusterName = raw.slice(1, -1);

    const url = CLUSTER_URLS[clusterName];
    if (!url) return null; // unknown cluster, leave for manual

    // Preserve original quote style
    const quote = raw[0];
    return node.replace(`${quote}${url}${quote}`);
  });

  const validEdits = edits.filter(Boolean) as NonNullable<(typeof edits)[number]>[];
  if (validEdits.length === 0) return null;

  return rootNode.commitEdits(validEdits);
};

export default transform;
