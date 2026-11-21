/** Formatting helpers for measurements. Inches use fractions to 1/16". */
import type { Units } from "./spec";

export function formatInches(v: number, denom = 16): string {
  const neg = v < 0;
  v = Math.abs(v);
  let whole = Math.floor(v);
  let num = Math.round((v - whole) * denom);
  if (num === denom) {
    whole += 1;
    num = 0;
  }
  let d = denom;
  while (num && num % 2 === 0) {
    num /= 2;
    d /= 2;
  }
  const frac = num ? `${num}/${d}` : "";
  const s = whole && frac ? `${whole}-${frac}` : whole ? `${whole}` : frac || "0";
  return `${neg ? "-" : ""}${s}"`;
}

export function formatLength(v: number, units: Units): string {
  return units === "in" ? formatInches(v) : `${Math.round(v)} mm`;
}

/** Format a value that is stored in inches according to the user's display unit. */
export function formatFromInches(vIn: number, display: Units): string {
  return display === "in" ? formatInches(vIn) : `${Math.round(vIn * 25.4)} mm`;
}

export const money = (v: number) => `$${v.toFixed(2)}`;
