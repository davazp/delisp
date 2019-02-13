import runtime from "@delisp/runtime";
import {
  Expression,
  isDeclaration,
  Module,
  SConditional,
  SDefinition,
  SFunction,
  SFunctionCall,
  SLet,
  SVariableReference,
  SVectorConstructor,
  Syntax
} from "./syntax";
import { mapObject } from "./utils";

import {
  compileInlinePrimitive,
  isInlinePrimitive
} from "./compiler/inline-primitives";
import { varnameToJS } from "./compiler/jsvariable";
import { pprint } from "./printer";

import * as JS from "estree";
import * as recast from "recast";

import createDebug from "debug";
const debug = createDebug("delisp:compiler");

interface EnvironmentBinding {
  jsname: string;
  source: "lexical" | "module" | "primitive";
}

interface Environment {
  definitionContainer?: string;
  bindings: {
    [symbol: string]: EnvironmentBinding;
  };
  usedPrimitives: Set<string>;
}

function addBinding(varName: string, env: Environment): Environment {
  return {
    ...env,
    bindings: {
      ...env.bindings,
      [varName]: { jsname: varnameToJS(varName), source: "lexical" }
    }
  };
}

function lookupBinding(varName: string, env: Environment) {
  return env.bindings[varName];
}

// Convert a Delisp variable name to Javascript. This function should
// be injective so there is no collisions and the output should be a
// valid variable name.

function compileLambda(
  fn: SFunction,
  env: Environment
): JS.ArrowFunctionExpression {
  const newEnv = fn.lambdaList.positionalArgs.reduce(
    (e, param) => addBinding(param.variable, e),
    env
  );

  const jsargs = fn.lambdaList.positionalArgs.map(
    (param): JS.Pattern => ({
      type: "Identifier",
      name: lookupBinding(param.variable, newEnv).jsname
    })
  );

  return {
    type: "ArrowFunctionExpression",
    params: [...jsargs],
    body: compile(fn.body, newEnv),
    expression: false
  };
}

function compileDefinition(def: SDefinition, env: Environment): JS.Expression {
  return {
    type: "AssignmentExpression",
    operator: "=",
    left: {
      type: "MemberExpression",
      computed: true,
      object: {
        type: "Identifier",
        name: "env"
      },
      property: {
        type: "Literal",
        value: def.variable
      }
    },
    right: compile(def.value, env)
  };
}

function compileFunctionCall(
  funcall: SFunctionCall,
  env: Environment
): JS.Expression {
  const compiledArgs = funcall.args.map(arg => compile(arg, env));
  if (
    funcall.fn.type === "variable-reference" &&
    isInlinePrimitive(funcall.fn.name)
  ) {
    return compileInlinePrimitive(funcall.fn.name, compiledArgs, "funcall");
  } else {
    return {
      type: "CallExpression",
      callee: compile(funcall.fn, env),
      arguments: compiledArgs
    };
  }
}

function compileVariable(
  ref: SVariableReference,
  env: Environment
): JS.Expression {
  if (isInlinePrimitive(ref.name)) {
    return compileInlinePrimitive(ref.name, [], "value");
  } else {
    const binding = lookupBinding(ref.name, env);
    if (!binding) {
      throw new Error(
        `Unknown reference ${ref.name} (this should never happen)`
      );
    }

    switch (binding.source) {
      case "primitive":
        return {
          type: "MemberExpression",
          computed: true,
          object: {
            type: "Identifier",
            name: "env"
          },
          property: {
            type: "Literal",
            value: binding.jsname
          }
        };
      case "module":
        return {
          type: "Identifier",
          name: binding.jsname
        };
      case "lexical":
        return {
          type: "Identifier",
          name: binding.jsname
        };
      default:
        throw new Error("Stupid TS");
    }
  }
}

function compileConditional(
  expr: SConditional,
  env: Environment
): JS.Expression {
  return {
    type: "ConditionalExpression",
    test: compile(expr.condition, env),
    consequent: compile(expr.consequent, env),
    alternate: compile(expr.alternative, env)
  };
}

function compileList(
  expr: SVectorConstructor,
  env: Environment
): JS.Expression {
  return {
    type: "ArrayExpression",
    elements: expr.values.map(e => compile(e, env))
  };
}

function compileLetBindings(expr: SLet, env: Environment): JS.Expression {
  const newenv = expr.bindings.reduce(
    (e, binding) => addBinding(binding.var, e),
    env
  );

  return {
    type: "CallExpression",
    callee: {
      type: "FunctionExpression",
      params: expr.bindings.map(
        (b): JS.Pattern => ({
          type: "Identifier",
          name: lookupBinding(b.var, newenv).jsname
        })
      ),
      body: {
        type: "BlockStatement",
        body: [
          {
            type: "ReturnStatement",
            argument: compile(expr.body, newenv)
          }
        ]
      }
    },
    arguments: expr.bindings.map(b => compile(b.value, env))
  };
}

export function compile(expr: Expression, env: Environment): JS.Expression {
  switch (expr.type) {
    case "number":
      return {
        type: "Literal",
        value: expr.value
      };
    case "string":
      return {
        type: "Literal",
        value: expr.value
      };
    case "variable-reference":
      return compileVariable(expr, env);
    case "conditional":
      return compileConditional(expr, env);
    case "function":
      return compileLambda(expr, env);
    case "function-call":
      return compileFunctionCall(expr, env);
    case "vector":
      return compileList(expr, env);
    case "let-bindings":
      return compileLetBindings(expr, env);
  }
}

function compileTopLevel(syntax: Syntax, env: Environment): JS.Expression {
  const js =
    syntax.type === "definition"
      ? compileDefinition(syntax, env)
      : compile(syntax, env);
  return {
    ...js,
    // Include a comment with the original source code immediately
    // before each toplevel compilation.
    leadingComments: [
      {
        type: "Block",
        value: `
${pprint(syntax, 60)}
`
      }
    ]
  };
}

function compileRuntime(): JS.VariableDeclaration {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: "env" },
        init: {
          type: "CallExpression",
          callee: { type: "Identifier", name: "require" },
          arguments: [{ type: "Literal", value: "@delisp/runtime" }]
        }
      }
    ]
  };
}

function compileModule(module: Module, includeRuntime: boolean): JS.Program {
  const moduleDeclarations = module.body
    .filter(isDeclaration)
    .map(decl => decl.variable);
  const moduleBindings = moduleDeclarations.reduce(
    (d, decl) => ({
      ...d,
      [decl]: { jsname: varnameToJS(decl), source: "module" }
    }),
    {}
  );
  const primitiveBindings = mapObject(
    runtime,
    (_, key: string): EnvironmentBinding => ({
      jsname: key,
      source: "primitive"
    })
  );

  const initialEnv = {
    bindings: { ...primitiveBindings, ...moduleBindings },
    usedPrimitives: new Set()
  };
  return {
    type: "Program",
    sourceType: "module",
    body: [
      ...(includeRuntime ? [compileRuntime()] : []),
      ...module.body.map(
        (syntax: Syntax): JS.ExpressionStatement => ({
          type: "ExpressionStatement",
          expression: compileTopLevel(syntax, initialEnv)
        })
      )
    ]
  };
}

export function compileToString(syntax: Syntax): string {
  const ast = compileModule({ type: "module", body: [syntax] }, false);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return code;
}

export function compileModuleToString(module: Module): string {
  const ast = compileModule(module, true);
  const code = recast.print(ast).code;
  debug("jscode:", code);
  return recast.print(ast).code;
}
