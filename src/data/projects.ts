import { uid } from "@/lib/platform";
import type { ProjectSpec } from "@/engine/spec";
import { repo } from "./repo";
import type { ProjectRecord } from "./types";

export async function createProject(spec: ProjectSpec, prompt: string, origin: string): Promise<ProjectRecord> {
  const now = new Date().toISOString();
  const p: ProjectRecord = {
    id: uid(),
    name: spec.name,
    prompt,
    status: "planning",
    spec,
    version: 1,
    createdAt: now,
    updatedAt: now,
    notes: "",
    purchased: [],
    completedSteps: [],
    photos: [],
    chat: [],
    origin,
  };
  await repo.saveProject(p);
  await repo.addVersion({ projectId: p.id, version: 1, note: "Initial design", spec, createdAt: now });
  return p;
}

export async function duplicateProject(src: ProjectRecord, asVariation = false): Promise<ProjectRecord> {
  const spec = { ...src.spec, name: `${src.spec.name} (${asVariation ? "variation" : "copy"})` };
  return createProject(spec, src.prompt, src.origin);
}
