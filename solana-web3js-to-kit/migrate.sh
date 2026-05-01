#!/usr/bin/env bash
# Usage: bash migrate.sh /path/to/target
set -e
TARGET="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Migrating $TARGET from @solana/web3.js v1 → @solana/kit"
echo ""

run() {
  echo "→ $2"
  npx codemod jssg run --language tsx "$SCRIPT_DIR/transforms/$1" \
    --target "$TARGET" --no-interactive --allow-dirty
}

run 01-imports.ts         "Rewriting imports"
run 08-cluster-api-url.ts "Resolving clusterApiUrl() to URL strings"
run 02-connection.ts      "Replacing new Connection()"
run 03-publickey.ts       "Replacing new PublicKey()"
run 04-keypair-generate.ts "Replacing Keypair.generate()"
run 05-keypair-props.ts   "Replacing .publicKey / .secretKey"
run 06-system-transfer.ts "Replacing SystemProgram.transfer()"
run 07-send-confirm.ts    "Replacing sendAndConfirmTransaction()"
run 09-rpc-send.ts        "Adding .send() to bare RPC calls"

echo ""
echo "✅ Automated migration complete."
echo ""
echo "⚠️  Manual review required for:"
echo "   • Keypair.fromSecretKey()       → createKeyPairSignerFromBytes()"
echo "   • new PublicKey(buffer)         → manual conversion"
echo "   • Multi-instruction transactions → pipe() pattern"
echo "   • Commitment levels              → per-call options"
echo ""
echo "Reference: https://github.com/anza-xyz/kit"
