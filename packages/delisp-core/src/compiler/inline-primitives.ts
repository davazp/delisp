import * as JS from "estree";
import { readType } from "../type-utils";
import { Type } from "../types";
import { range } from "../utils";

type InlineHandler = (args: JS.Expression[]) => JS.Expression;

interface InlinePrim {
  type: Type;
  handle: InlineHandler;
}

const inlinefuncs = new Map<string, InlinePrim>();

export function getInlinePrimitiveTypes(): { [name: string]: Type } {
  return Array.from(inlinefuncs.entries()).reduce(
    (obj, [name, prim]) => ({ ...obj, [name]: prim.type }),
    {}
  );
}

function defineInlinePrimitive(
  name: string,
  typespec: string,
  handle: InlineHandler
) {
  const type = readType(typespec);
  return inlinefuncs.set(name, { type, handle });
}

export function isInlinePrimitive(name: string) {
  return inlinefuncs.has(name);
}

export function findInlinePrimitive(name: string): InlinePrim {
  const prim = inlinefuncs.get(name);
  if (!prim) {
    throw new Error(`${name} is not an primitive inline function call`);
  }
  return prim;
}

function primitiveArity(prim: InlinePrim): number {
  const type = prim.type.mono;
  if (type.type === "application" && type.op === "->") {
    return type.args.length - 1;
  } else {
    return 0;
  }
}

/** Compile a inline primitive with a set of parameters.
 *
 * @description If `position` is not a function call, a wrapper
 * function will be created so the inlined primitive can be used as a
 * function.
 *
 */
export function compileInlinePrimitive(
  name: string,
  args: JS.Expression[],
  position: "funcall" | "value"
): JS.Expression {
  const prim = findInlinePrimitive(name);
  const arity = primitiveArity(prim);

  if (position === "funcall" || arity === 0) {
    return prim.handle(args);
  } else {
    const identifiers = range(arity).map(
      (i): JS.Identifier => ({
        type: "Identifier",
        name: `x${i}`
      })
    );
    return {
      type: "ArrowFunctionExpression",
      params: identifiers,
      body: prim.handle(identifiers),
      expression: true
    };
  }
}

defineInlinePrimitive("true", "boolean", () => {
  return {
    type: "Literal",
    value: true
  };
});

defineInlinePrimitive("false", "boolean", () => {
  return {
    type: "Literal",
    value: false
  };
});

defineInlinePrimitive("+", "(-> number number number)", args => {
  return {
    type: "BinaryExpression",
    operator: "+",
    left: args[0],
    right: args[1]
  };
});

defineInlinePrimitive("*", "(-> number number number)", args => {
  return {
    type: "BinaryExpression",
    operator: "*",
    left: args[0],
    right: args[1]
  };
});