/**
 * Safe arithmetic expression evaluator.
 *
 * Why not `eval()`? Expressions come from AI output and saved files. `eval`
 * would execute arbitrary JavaScript. This is a small recursive-descent
 * parser that only understands numbers, named variables, + - * / %,
 * parentheses and a whitelist of math functions.
 *
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := unary (('*' | '/' | '%') unary)*
 *   unary  := '-' unary | primary
 *   primary:= NUMBER | IDENT | IDENT '(' expr (',' expr)* ')' | '(' expr ')'
 */
import type { Expr } from "./spec";

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
};

export class ExprError extends Error {}

type Token = { kind: "num"; value: number } | { kind: "id"; value: string } | { kind: "op"; value: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?/i.exec(src.slice(i)) ?? /^[0-9]+\.?/.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number at "${src.slice(i)}"`);
      out.push({ kind: "num", value: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))!;
      out.push({ kind: "id", value: m[0] });
      i += m[0].length;
    } else if ("+-*/%(),".includes(c)) {
      out.push({ kind: "op", value: c });
      i++;
    } else {
      throw new ExprError(`Unexpected character "${c}" in "${src}"`);
    }
  }
  return out;
}

/** Returns the variable names an expression refers to (for dependency ordering). */
export function referencedNames(e: Expr): string[] {
  if (typeof e === "number") return [];
  const toks = tokenize(e);
  return toks
    .filter((t, i) => t.kind === "id" && !(toks[i + 1]?.kind === "op" && toks[i + 1].value === "("))
    .map((t) => t.value as string);
}

export function evaluate(e: Expr, scope: Record<string, number>): number {
  if (typeof e === "number") return e;
  const toks = tokenize(e);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.kind === "op" && peek()!.value === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new ExprError(`Expected "${v}" in "${e}"`);
    pos++;
  };

  function parseExpr(): number {
    let v = parseTerm();
    while (isOp("+") || isOp("-")) {
      const op = toks[pos++].value;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseUnary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = toks[pos++].value;
      const r = parseUnary();
      if ((op === "/" || op === "%") && r === 0) throw new ExprError(`Division by zero in "${e}"`);
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function parseUnary(): number {
    if (isOp("-")) {
      pos++;
      return -parseUnary();
    }
    if (isOp("+")) {
      pos++;
      return parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const t = peek();
    if (!t) throw new ExprError(`Unexpected end of "${e}"`);
    if (t.kind === "num") {
      pos++;
      return t.value;
    }
    if (t.kind === "id") {
      pos++;
      if (isOp("(")) {
        const fn = FUNCS[t.value];
        if (!fn) throw new ExprError(`Unknown function "${t.value}"`);
        pos++;
        const args = [parseExpr()];
        while (isOp(",")) {
          pos++;
          args.push(parseExpr());
        }
        expectOp(")");
        return fn(...args);
      }
      if (!(t.value in scope)) throw new ExprError(`Unknown name "${t.value}" in "${e}"`);
      return scope[t.value];
    }
    if (isOp("(")) {
      pos++;
      const v = parseExpr();
      expectOp(")");
      return v;
    }
    throw new ExprError(`Unexpected "${t.value}" in "${e}"`);
  }

  const result = parseExpr();
  if (pos !== toks.length) throw new ExprError(`Unexpected trailing input in "${e}"`);
  if (!Number.isFinite(result)) throw new ExprError(`"${e}" did not produce a finite number`);
  return result;
}

/**
 * Build the evaluation scope: parameters first, then derived values in
 * dependency order (so a derived value may reference another one defined
 * later in the list). Detects cycles.
 */
export function buildScope(
  params: { key: string; value: number }[],
  derived: { key: string; expr: Expr }[],
  overrides: Record<string, number> = {},
): Record<string, number> {
  const scope: Record<string, number> = {};
  for (const p of params) scope[p.key] = overrides[p.key] ?? p.value;
  const pending = new Map(derived.map((d) => [d.key, d.expr]));
  const visiting = new Set<string>();
  const resolve = (key: string) => {
    if (key in scope) return;
    const ex = pending.get(key);
    if (ex === undefined) return; // unknown names surface in evaluate()
    if (visiting.has(key)) throw new ExprError(`Circular definition involving "${key}"`);
    visiting.add(key);
    for (const dep of referencedNames(ex)) resolve(dep);
    scope[key] = evaluate(ex, scope);
    visiting.delete(key);
  };
  for (const d of derived) resolve(d.key);
  return scope;
}
