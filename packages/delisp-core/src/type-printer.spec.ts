import { printType } from "./type-printer";
import * as T from "./types";

describe("Type printer", () => {
  test("effect types are printed properly", () => {
    expect(printType(T.effect(["console", "async"]), false)).toBe(
      "(effect console async)"
    );
  });

  test("open effect types are printed properly", () => {
    expect(printType(T.effect(["console", "async"], T.tVar("a")), false)).toBe(
      "(effect console async | a)"
    );
  });

  test("cases type are printed correctly", () => {
    expect(
      printType(
        T.cases(
          [{ label: ":a", type: T.tVar("a") }, { label: ":b", type: T.void }],
          T.tVar("c")
        ),
        false
      )
    ).toBe("(cases (:a a) :b c)");
  });

  test("print function types returning a single value", () => {
    expect(printType(T.fn([], T.effect([]), T.tVar("a")), false)).toBe(
      "(-> (effect) a)"
    );
    expect(
      printType(
        T.multiValuedFunction([], T.effect([]), T.values([T.tVar("a")])),
        false
      )
    ).toBe("(-> (effect) a)");
  });

  test("print function types returning multiple values", () => {
    expect(
      printType(
        T.multiValuedFunction(
          [],
          T.effect([]),
          T.values([T.tVar("a"), T.tVar("a")])
        ),
        false
      )
    ).toBe("(-> (effect) (values a a))");
  });
});
