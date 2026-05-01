import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

// Every method on the @solana/kit RPC object returns a RpcRequest that needs .send()
const RPC_METHODS = [
  "getBalance",
  "getLatestBlockhash",
  "getRecentBlockhash",
  "getAccountInfo",
  "getMultipleAccountsInfo",
  "getProgramAccounts",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getTokenSupply",
  "getSlot",
  "getBlockHeight",
  "getBlockTime",
  "getBlock",
  "getBlocks",
  "getTransaction",
  "getSignaturesForAddress",
  "getSignatureStatuses",
  "requestAirdrop",
  "simulateTransaction",
  "sendRawTransaction",
  "getMinimumBalanceForRentExemption",
  "getEpochInfo",
  "getEpochSchedule",
  "getInflationReward",
  "getInflationRate",
  "getLargestAccounts",
  "getLeaderSchedule",
  "getNonce",
  "getNonceAndContext",
  "getStakeActivation",
  "getSupply",
  "getVoteAccounts",
  "getVersion",
  "getClusterNodes",
  "getGenesisHash",
  "getIdentity",
  "getHealth",
  "getPerformanceSamples",
];

// "client" is intentionally excluded — too generic (BanksClient, AnchorProvider, HTTP clients)
// Only names that are unambiguously Solana RPC connections
const BASELINE_RPC_NAMES = [
  "connection", "conn", "rpc", "solana",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const posKey = (node: any): string => {
  const { start } = node.range();
  return `${start.line}:${start.column}`;
};

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  // Discover connection variable names from assignments
  const rpcNames = new Set(BASELINE_RPC_NAMES);

  for (const pattern of [
    "const $VAR = createSolanaRpc($$$)",
    "let $VAR = createSolanaRpc($$$)",
    "const $VAR = new Connection($$$)",
    "let $VAR = new Connection($$$)",
  ]) {
    rootNode.findAll({ rule: { pattern } }).forEach((m) => {
      const name = m.getMatch("VAR")?.text();
      if (name) rpcNames.add(name);
    });
  }

  // Pass 1: record start positions of calls that already end with .send()
  // Both `rpc.getMethod($$$).send()` and its inner `rpc.getMethod($$$)` start
  // at the same character, so we key on the outer call's position.
  const alreadySent = new Set<string>();
  for (const varName of rpcNames) {
    for (const method of RPC_METHODS) {
      rootNode
        .findAll({ rule: { pattern: `${varName}.${method}($$$).send()` } })
        .forEach((m) => alreadySent.add(posKey(m)));
    }
  }

  // Pass 2: add .send() to every bare RPC call not already in the sent set
  const edits: ReturnType<typeof rootNode.find>[] = [];

  for (const varName of rpcNames) {
    rootNode
      .findAll({
        rule: {
          any: RPC_METHODS.map((method) => ({ pattern: `${varName}.${method}($$$)` })),
        },
      })
      .forEach((m) => {
        if (!alreadySent.has(posKey(m))) {
          edits.push(m.replace(`${m.text()}.send()`));
        }
      });
  }

  if (edits.length === 0) return null;

  return rootNode.commitEdits(edits as Parameters<typeof rootNode.commitEdits>[0]);
};

export default transform;
