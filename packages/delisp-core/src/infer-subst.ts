import { assertNever, InvariantViolation } from "./invariant";
import * as S from "./syntax";
import { Typed } from "./syntax-typed";
import { transformRecurExpr } from "./syntax-utils";
import { applySubstitution, Substitution } from "./type-utils";

export function applyTypeSubstitutionToVariable(
  s: S.SVariableReference<Typed>,
  env: Substitution
): S.SVariableReference<Typed> {
  const result = applySubstitutionToExpr(s, env);
  if (result.node.tag !== "variable-reference") {
    throw new InvariantViolation(
      `Replacing types to a syntax variable should still be syntax variable!`
    );
  }
  return { ...s, node: result.node };
}

export function applySubstitutionToExpr(
  s: S.Expression<Typed>,
  env: Substitution
): S.Expression<Typed> {
  return transformRecurExpr(s, expr => {
    const tmp: S.Expression<Typed> = {
      ...expr,
      info: new Typed({
        selfType: applySubstitution(expr.info.selfType, env),
        resultingType:
          expr.info._resultingType &&
          applySubstitution(expr.info._resultingType, env),
        effect: applySubstitution(expr.info.effect, env)
      })
    };
    switch (tmp.node.tag) {
      case "function-call":
      case "variable-reference":
        return {
          ...tmp,
          node: {
            ...tmp.node,
            closedFunctionEffect:
              tmp.node.closedFunctionEffect &&
              applySubstitution(tmp.node.closedFunctionEffect, env)
          }
        };
      default:
        return tmp;
    }
  });
}

export function applySubstitutionToSyntax(
  s: S.Syntax<Typed>,
  env: Substitution
): S.Syntax<Typed> {
  if (S.isExpression(s)) {
    return applySubstitutionToExpr(s, env);
  } else if (s.node.tag === "definition") {
    return {
      ...s,
      node: {
        ...s.node,
        value: applySubstitutionToExpr(s.node.value, env)
      }
    };
  } else if (s.node.tag === "export") {
    return s;
  } else if (s.node.tag === "type-alias") {
    return s;
  } else if (s.node.tag === "import") {
    return s;
  } else {
    return assertNever(s.node);
  }
}
