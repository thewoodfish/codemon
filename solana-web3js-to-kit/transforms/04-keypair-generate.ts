import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const FUNCTION_KINDS = new Set([
  "function_declaration",
  "function",
  "arrow_function",
  "method_definition",
  "generator_function_declaration",
  "generator_function",
]);

function nearestFunctionIsAsync(node: ReturnType<ReturnType<typeof node.parent>["parent"]>): boolean {
  let ancestor = node.parent();
  while (ancestor) {
    if (FUNCTION_KINDS.has(ancestor.kind())) {
      // Check the function signature (text before the opening `{`) for the
      // `async` keyword. This correctly handles:
      //   async function main() { ... }
      //   export async function main() { ... }   ← function_declaration starts at "async"
      //   const f = async () => { ... }          ← arrow_function starts at "async"
      //   class Foo { public async run() { } }   ← "public async" before "{"
      const text = ancestor.text();
      const braceIdx = text.indexOf("{");
      const signature = braceIdx >= 0 ? text.slice(0, braceIdx) : text;
      return /\basync\b/.test(signature);
    }
    ancestor = ancestor.parent();
  }
  return false;
}

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const matches = rootNode.findAll({
    rule: { pattern: "Keypair.generate()" },
  });

  if (matches.length === 0) return null;

  const edits = matches
    .map((node) => {
      if (!nearestFunctionIsAsync(node)) return null;
      return node.replace("await generateKeyPairSigner()");
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof matches[0]["replace"]>>[];

  if (edits.length === 0) return null;

  return rootNode.commitEdits(edits);
};

export default transform;
