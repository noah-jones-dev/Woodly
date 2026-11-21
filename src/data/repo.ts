/**
 * Storage. Local-first: everything lives on the user's machine.
 *
 *   Desktop → SQLite (tauri-plugin-sql; schema migrations live in Rust)
 *   Browser dev → localStorage
 *
 * Both implement the same `Repo` interface, so the UI never cares which.
 * The project spec is stored as JSON: it's versioned (schemaVersion) and
 * every revision is kept in project_versions for history / rollback.
 */
import { isTauri } from "@/lib/platform";
import { ProjectSpec } from "@/engine/spec";
import { DEFAULT_SETTINGS, type LessonProgress, type ProjectRecord, type ProjectVersion, type Settings } from "./types";

export interface Repo {
  listProjects(): Promise<ProjectRecord[]>;
  getProject(id: string): Promise<ProjectRecord | undefined>;
  saveProject(p: ProjectRecord): Promise<void>;
  deleteProject(id: string): Promise<void>;
  addVersion(v: ProjectVersion): Promise<void>;
  listVersions(projectId: string): Promise<ProjectVersion[]>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  getProgress(): Promise<LessonProgress[]>;
  saveProgress(p: LessonProgress): Promise<void>;
}

/** Merge stored settings over defaults so new fields get sane values. */
function withDefaults(s: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    profile: { ...DEFAULT_SETTINGS.profile, ...s?.profile },
    ai: { ...DEFAULT_SETTINGS.ai, ...s?.ai, routes: { ...DEFAULT_SETTINGS.ai.routes, ...s?.ai?.routes } },
  };
}

/** Re-validate specs on load so old/corrupt data can't crash the engine. */
function reviveProject(raw: ProjectRecord): ProjectRecord {
  return { ...raw, spec: ProjectSpec.parse(raw.spec) };
}

class LocalRepo implements Repo {
  private read<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`woodly.${key}`);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: unknown) {
    localStorage.setItem(`woodly.${key}`, JSON.stringify(value));
  }
  async listProjects() {
    return this.read<ProjectRecord[]>("projects", []).map(reviveProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getProject(id: string) {
    return (await this.listProjects()).find((p) => p.id === id);
  }
  async saveProject(p: ProjectRecord) {
    const all = this.read<ProjectRecord[]>("projects", []).filter((x) => x.id !== p.id);
    this.write("projects", [...all, p]);
  }
  async deleteProject(id: string) {
    this.write("projects", this.read<ProjectRecord[]>("projects", []).filter((x) => x.id !== id));
    this.write("versions", this.read<ProjectVersion[]>("versions", []).filter((v) => v.projectId !== id));
  }
  async addVersion(v: ProjectVersion) {
    this.write("versions", [...this.read<ProjectVersion[]>("versions", []), v]);
  }
  async listVersions(projectId: string) {
    return this.read<ProjectVersion[]>("versions", []).filter((v) => v.projectId === projectId).sort((a, b) => b.version - a.version);
  }
  async getSettings() {
    return withDefaults(this.read<Partial<Settings> | undefined>("settings", undefined));
  }
  async saveSettings(s: Settings) {
    this.write("settings", s);
  }
  async getProgress() {
    return this.read<LessonProgress[]>("progress", []);
  }
  async saveProgress(p: LessonProgress) {
    this.write("progress", [...this.read<LessonProgress[]>("progress", []).filter((x) => x.lessonKey !== p.lessonKey), p]);
  }
}

type Db = { select<T>(q: string, b?: unknown[]): Promise<T>; execute(q: string, b?: unknown[]): Promise<unknown> };

class SqliteRepo implements Repo {
  private db?: Promise<Db>;
  private conn(): Promise<Db> {
    this.db ??= import("@tauri-apps/plugin-sql").then((m) => m.default.load("sqlite:woodly.db") as Promise<Db>);
    return this.db;
  }
  async listProjects() {
    const rows = await (await this.conn()).select<{ data: string }[]>("SELECT data FROM projects ORDER BY updated_at DESC");
    return rows.map((r) => reviveProject(JSON.parse(r.data)));
  }
  async getProject(id: string) {
    const rows = await (await this.conn()).select<{ data: string }[]>("SELECT data FROM projects WHERE id = $1", [id]);
    return rows[0] ? reviveProject(JSON.parse(rows[0].data)) : undefined;
  }
  async saveProject(p: ProjectRecord) {
    await (await this.conn()).execute(
      "INSERT INTO projects (id, name, status, data, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET name = $2, status = $3, data = $4, updated_at = $5",
      [p.id, p.name, p.status, JSON.stringify(p), p.updatedAt],
    );
  }
  async deleteProject(id: string) {
    const db = await this.conn();
    await db.execute("DELETE FROM project_versions WHERE project_id = $1", [id]);
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  }
  async addVersion(v: ProjectVersion) {
    await (await this.conn()).execute(
      "INSERT OR REPLACE INTO project_versions (project_id, version, note, spec, created_at) VALUES ($1, $2, $3, $4, $5)",
      [v.projectId, v.version, v.note, JSON.stringify(v.spec), v.createdAt],
    );
  }
  async listVersions(projectId: string) {
    const rows = await (await this.conn()).select<{ project_id: string; version: number; note: string; spec: string; created_at: string }[]>(
      "SELECT * FROM project_versions WHERE project_id = $1 ORDER BY version DESC",
      [projectId],
    );
    return rows.map((r) => ({ projectId: r.project_id, version: r.version, note: r.note, spec: ProjectSpec.parse(JSON.parse(r.spec)), createdAt: r.created_at }));
  }
  async getSettings() {
    const rows = await (await this.conn()).select<{ value: string }[]>("SELECT value FROM settings WHERE key = 'app'");
    return withDefaults(rows[0] ? JSON.parse(rows[0].value) : undefined);
  }
  async saveSettings(s: Settings) {
    await (await this.conn()).execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('app', $1)", [JSON.stringify(s)]);
  }
  async getProgress() {
    const rows = await (await this.conn()).select<{ lesson_key: string; status: LessonProgress["status"]; progress: number; updated_at: string }[]>(
      "SELECT * FROM learning_progress",
    );
    return rows.map((r) => ({ lessonKey: r.lesson_key, status: r.status, progress: r.progress, updatedAt: r.updated_at }));
  }
  async saveProgress(p: LessonProgress) {
    await (await this.conn()).execute(
      "INSERT OR REPLACE INTO learning_progress (lesson_key, status, progress, updated_at) VALUES ($1, $2, $3, $4)",
      [p.lessonKey, p.status, p.progress, p.updatedAt],
    );
  }
}

export const repo: Repo = isTauri ? new SqliteRepo() : new LocalRepo();
