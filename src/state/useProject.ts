import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { repo } from "@/data/repo";
import type { ProjectRecord } from "@/data/types";
import { analyze } from "@/engine";
import type { ProjectSpec } from "@/engine/spec";

/**
 * Load a project, derive its engine analysis, and persist changes.
 * `saveSpec(spec, note)` bumps the version and records it in history;
 * `patch` saves non-design fields (notes, status, checklists) silently.
 *
 * A ref mirrors the latest project so rapid successive edits never
 * overwrite each other with stale data.
 */
export function useProject(id: string | undefined) {
  const [project, setProjectState] = useState<ProjectRecord | undefined | null>(undefined);
  const ref = useRef<ProjectRecord | undefined | null>(undefined);
  const setProject = (p: ProjectRecord | undefined | null) => {
    ref.current = p;
    setProjectState(p);
  };

  useEffect(() => {
    if (!id) return;
    repo.getProject(id).then((p) => setProject(p ?? null));
  }, [id]);

  const spec = project?.spec;
  const analysis = useMemo(() => (spec ? analyze(spec) : undefined), [spec]);

  const patch = useCallback(async (fn: (p: ProjectRecord) => Partial<ProjectRecord>) => {
    const cur = ref.current;
    if (!cur) return;
    const next = { ...cur, ...fn(cur), updatedAt: new Date().toISOString() };
    setProject(next);
    await repo.saveProject(next);
  }, []);

  const saveSpec = useCallback(async (spec: ProjectSpec, note: string) => {
    const cur = ref.current;
    if (!cur) return;
    const version = cur.version + 1;
    const next: ProjectRecord = { ...cur, spec, name: spec.name, version, updatedAt: new Date().toISOString() };
    ref.current = next; // later edits build on this one immediately
    // Record history first: screens re-read it as soon as `version` changes.
    await repo.addVersion({ projectId: cur.id, version, note, spec, createdAt: next.updatedAt });
    await repo.saveProject(next);
    setProject(next);
  }, []);

  return { project, analysis, patch, saveSpec };
}
