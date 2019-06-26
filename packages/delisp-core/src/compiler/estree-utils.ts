import * as JS from "estree";
import { isValidJSIdentifierName } from "./jsvariable";

export function member(obj: JS.Expression, prop: string): JS.MemberExpression {
  const dotNotation = isValidJSIdentifierName(prop);
  return {
    type: "MemberExpression",
    computed: !dotNotation,
    object: obj,
    property: dotNotation ? identifier(prop) : literal(prop)
  };
}

export function methodCall(
  e: JS.Expression,
  method: string,
  args: JS.Expression[]
): JS.CallExpression {
  return {
    type: "CallExpression",
    callee: member(e, method),
    arguments: args
  };
}

/** Generate an arrow function in JS
 *
 * @description This will execute all the expressions, returning the
 * last one. */
export function arrowFunction(
  args: JS.Pattern[],
  body: JS.Expression[]
): JS.ArrowFunctionExpression {
  if (body.length === 0) {
    throw new Error(`Empty body`);
  }

  if (body.length === 1) {
    const expr = body[0];
    return {
      type: "ArrowFunctionExpression",
      params: args,
      body: expr,
      generator: false,
      expression: true,
      async: false
    };
  } else {
    const middle: JS.Statement[] = body.slice(0, -1).map(e => ({
      type: "ExpressionStatement",
      expression: e
    }));

    const returning: JS.Statement = {
      type: "ReturnStatement",
      argument: body[body.length - 1]
    };

    return {
      type: "ArrowFunctionExpression",
      params: args,
      body: {
        type: "BlockStatement",
        body: [...middle, returning]
      },
      generator: false,
      expression: false,
      async: false
    };
  }
}

export function literal(value: number | string | boolean | null): JS.Literal {
  return {
    type: "Literal",
    value
  };
}

export function identifier(name: string): JS.Identifier {
  return {
    type: "Identifier",
    name
  };
}

export function op(
  operator: JS.BinaryOperator,
  left: JS.Expression,
  right: JS.Expression
): JS.BinaryExpression {
  return { type: "BinaryExpression", operator, left, right };
}

export function primitiveCall(
  name: string,
  ...args: JS.Expression[]
): JS.Expression {
  return {
    type: "CallExpression",
    callee: identifier(name),
    arguments: args
  };
}
