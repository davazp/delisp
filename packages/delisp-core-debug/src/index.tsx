import styled from "styled-components";
import React, { useReducer } from "react";
import ReactDOM from "react-dom";

import { updateCode, State, reducer } from "./state";

import {
  Module,
  Syntax,
  isExpression,
  readModule,
  inferModule,
  pprint,
  exprFChildren,
  SDefinition,
  isDefinition,
  isTypeAlias,
  isExport,
  // SExport,
  // STypeAlias,
  Expression,
  Typed
} from "@delisp/core";

const initialState: State = {
  code: ""
};

type ASTResult =
  | { tag: "success"; module: Module<Typed> }
  | { tag: "error"; message: string };

export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}

function readModuleOrError(code: string): ASTResult {
  try {
    const m = readModule(code);
    const inferredM = inferModule(m);
    return { tag: "success", module: inferredM.typedModule };
  } catch (err) {
    return { tag: "error", message: err.message };
  }
}

function AST(props: { code: string }) {
  const { code } = props;
  const result = readModuleOrError(code);
  switch (result.tag) {
    case "success":
      return <ModuleExplorer module={result.module} />;
    case "error":
      return (
        <div>
          <span>Something went wrong</span>
          <pre>{result.message}</pre>
        </div>
      );
  }
}

function ModuleExplorer({ module: m }: { module: Module<Typed> }) {
  return (
    <div>
      {m.body.map((s, i) => (
        <SyntaxExplorer key={i} syntax={s} />
      ))}
    </div>
  );
}

function SyntaxExplorer({ syntax }: { syntax: Syntax<Typed> }) {
  if (isExpression(syntax)) {
    return <ExpressionExplorer expr={syntax} />;
  } else if (isDefinition(syntax)) {
    return <DefinitionExplorer definition={syntax} />;
  } else if (isExport(syntax)) {
    return <UnknownExplorer value={syntax} />;
  } else if (isTypeAlias(syntax)) {
    return <UnknownExplorer value={syntax} />;
  } else {
    throw new Error(`??? TS is not detecting exhaustiveness.`);
  }
}

function DefinitionExplorer({
  definition
}: {
  definition: SDefinition<Typed>;
}) {
  return (
    <div>
      <span>Definition: {definition.node.variable.name}</span>
      <ExpressionExplorer expr={definition.node.value} />
    </div>
  );
}

const Box = styled.div`
  border: 1px solid;
  margin: 10px;
  padding: 5px;
`;

function ExpressionExplorer({ expr }: { expr: Expression<Typed> }) {
  const subexpr = exprFChildren(expr).map((e, i) => (
    <ExpressionExplorer key={i} expr={e} />
  ));
  return (
    <Box>
      <pre>{pprint(expr, 80)}</pre>
      {subexpr.length === 0 ? null : (
        <details>
          <summary>Subexpressions</summary>
          {subexpr}
        </details>
      )}
      <details>
        <summary>Type</summary>
        <UnknownExplorer value={expr.info.type} />
      </details>
      <details>
        <summary>Effect</summary>
        <UnknownExplorer value={expr.info.effect} />
      </details>
      <details>
        <summary>Location</summary>
        <UnknownExplorer value={expr.location} />
      </details>
      <div />
    </Box>
  );
}

function UnknownExplorer({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div>
      <h1>delisp-core-debug</h1>
      <textarea
        value={state.code}
        onChange={e => dispatch(updateCode(e.target.value))}
      />
      <AST code={state.code} />
    </div>
  );
}

function start() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  ReactDOM.render(<App />, container);
}

start();
