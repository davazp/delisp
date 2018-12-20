import { readSyntax } from "../src/index";
import { evaluate } from "../src/eval";

function evaluateString(str: string): any {
  return evaluate(readSyntax(str));
}

describe("Evaluation", () => {
  describe("Numbers", () => {
    it("should self-evaluate", () => {
      expect(evaluateString("0")).toBe(0);
      expect(evaluateString("1")).toBe(1);
      expect(evaluateString("-1")).toBe(-1);
    });
  });

  describe("Strings", () => {
    it("should self-evaluate", () => {
      expect(evaluateString('""')).toBe("");
      expect(evaluateString('"foo"')).toBe("foo");
      expect(evaluateString('"a\\nb"')).toBe("a\nb");
    });
  });

  describe("Function calls", () => {
    it("should evaluate to the right value", () => {
      expect(evaluateString("(+ 1 2)")).toBe(3);
      expect(evaluateString("(+ (+ 1 1) 2)")).toBe(4);
    });
  });

  describe("Lambda abstractions", () => {
    it("should be able to be called", () => {
      expect(evaluateString("((lambda (x y) y) 4 5)")).toBe(5);
    });

    // Regression
    it("different argument names should not shadow", () => {
      expect(
        evaluateString(`
((lambda (x)
  ((lambda (y) x) 11))
 33)
`)
      ).toBe(33);
    });
  });

  describe("Let bindings", () => {
    it("should evaluate to the right value", () => {
      expect(evaluateString("(let () 5)")).toBe(5);
      expect(evaluateString("(let ((x 5)) x)")).toBe(5);
      expect(evaluateString("(let ((x 5) (y 5)) (+ x y))")).toBe(10);
      expect(
        evaluateString(`
(let ((const (lambda (x)
               (lambda (y) x))))
  (+ ((const 10) "foo")
     ((const 20) 42)))
`)
      ).toBe(30);
    });

    it("inner lets should shadow outer ones", () => {
      expect(evaluateString("(let ((x 5)) (let ((x 1)) x))")).toBe(1);
    });
  });

  describe("lists", () => {
    expect(evaluateString("(empty? nil)")).toBe(true);
    expect(evaluateString("(not (empty? (cons 1 nil)))")).toBe(true);
    expect(evaluateString("(first (cons 1 nil))")).toBe(1);
    expect(evaluateString("(rest (cons 1 nil))")).toEqual([]);
  });
});
