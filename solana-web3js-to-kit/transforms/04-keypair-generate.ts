import type { Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TSX> = (root) => {
  const rootNode = root.root();

  const matches = rootNode.findAll({
    rule: { pattern: "Keypair.generate()" },
  });

  if (matches.length === 0) return null;

  // Only transform when the call is already inside an async function.
  // Walking ancestors: look for async_function, async arrow_function, etc.
  const edits = matches
    .map((node) => {
      let ancestor = node.parent();
      let insideAsync = false;
      while (ancestor) {
        const kind = ancestor.kind();
        if (
          kind === "function_declaration" ||
          kind === "function" ||
          kind === "arrow_function" ||
          kind === "method_definition"
        ) {
          // Check if it has an `async` keyword by inspecting text prefix
          const text = ancestor.text();
          if (text.trimStart().startsWith("async")) {
            insideAsync = true;
          }
          break;
        }
        ancestor = ancestor.parent();
      }

      if (!insideAsync) return null;
      return node.replace("await generateKeyPairSigner()");
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof matches[0]["replace"]>>[];

  if (edits.length === 0) return null;

  return rootNode.commitEdits(edits);
};

export default transform;
