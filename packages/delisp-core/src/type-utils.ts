import { Monotype, TVar, Type } from "./types";
import { applySubstitution, Substitution } from "./unify";
import { flatten, unique } from "./utils";

// Return the list of type variables in the order they show up
export function listTypeVariables(t: Monotype): string[] {
  switch (t.type) {
    case "string":
      return [];
    case "number":
      return [];
    case "application":
      return unique(flatten(t.args.map(listTypeVariables)));
    case "type-variable":
      return [t.name];
  }
}

let generateUniqueTVarIdx = 0;
export const generateUniqueTVar = (): TVar => ({
  type: "type-variable",
  name: `t${++generateUniqueTVarIdx}`
});

export function generalize(t: Monotype, monovars: string[]): Type {
  const vars = listTypeVariables(t);
  return {
    type: "type",
    // All free variables in the type that are not in the set of
    // monomorphic set must be polymorphic. So we generalize over
    // them.
    tvars: vars.filter(v => !monovars.includes(v)),
    mono: t
  };
}

export function instantiate(t: Type): Monotype {
  const subst = t.tvars.reduce((s, vname) => {
    return {
      ...s,
      [vname]: generateUniqueTVar()
    };
  }, {});
  return applySubstitution(t.mono, subst);
}

function typeIndexName(index: number): string {
  const alphabet = "αβγδεζηθικμνξοπρστυφχψ";
  return index < alphabet.length
    ? alphabet[index]
    : `ω${index - alphabet.length + 1}`;
}

function normalizeType(t: Monotype): Monotype {
  const vars = listTypeVariables(t);
  const substitution = vars.reduce((s, v, i) => {
    const normalizedName = typeIndexName(i);
    return v === normalizedName
      ? s
      : {
          ...s,
          [v]: {
            type: "type-variable",
            name: normalizedName
          }
        };
  }, {});
  return applySubstitution(t, substitution);
}

function _printType(type: Monotype): string {
  switch (type.type) {
    case "application":
      return `(${type.op} ${type.args.map(_printType).join(" ")})`;
    case "number":
      return "number";
    case "string":
      return "string";
    case "type-variable":
      return type.name;
  }
}

export function printType(rawType: Monotype) {
  const type = normalizeType(rawType);
  return _printType(type);
}