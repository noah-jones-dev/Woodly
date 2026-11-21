import { useApp } from "@/state/store";
import { formatFromInches } from "@/engine/format";
import type { ProjectSpec } from "@/engine/spec";

/**
 * Measurement formatter that honors the user's preferred display units.
 * `fmt` takes a value in the spec's units; `fmtIn` takes inches (stock and
 * cut-plan values are always inches).
 */
export function useFormat(spec?: ProjectSpec) {
  const display = useApp((s) => s.settings.profile.units);
  const toIn = spec?.units === "mm" ? 1 / 25.4 : 1;
  return {
    fmt: (v: number) => formatFromInches(v * toIn, display),
    fmtIn: (v: number) => formatFromInches(v, display),
    display,
  };
}
