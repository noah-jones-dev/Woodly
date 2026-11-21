import type { ChatMessage, AITask, ProviderId } from "@/ai/types";
import type { Difficulty, ProjectSpec, Units } from "@/engine/spec";

export type ProjectStatus = "planning" | "gathering" | "ready" | "in-progress" | "completed";
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  gathering: "Gathering Materials",
  ready: "Ready to Build",
  "in-progress": "In Progress",
  completed: "Completed",
};

export type ProjectRecord = {
  id: string;
  name: string;
  prompt: string;
  status: ProjectStatus;
  spec: ProjectSpec;
  version: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
  /** Shopping-list item keys the user has checked off. */
  purchased: string[];
  /** Indexes of completed instruction steps. */
  completedSteps: number[];
  /** Photos of the work as data URLs (kept local). */
  photos: { id: string; dataUrl: string; caption: string; addedAt: string }[];
  chat: ChatMessage[];
  /** How the spec was produced: "template:<key>", "ai:<provider>/<model>". */
  origin: string;
};

export type ProjectVersion = { projectId: string; version: number; note: string; spec: ProjectSpec; createdAt: string };

export type Profile = {
  experience: Difficulty;
  units: Units;
  ownedTools: string[];
};

export type AIRoute = { provider: ProviderId; model: string };

export type Settings = {
  profile: Profile;
  ai: {
    routes: Record<AITask, AIRoute>;
    /** Providers the user has saved a key for (the key itself lives in the keychain). */
    configured: ProviderId[];
    acknowledgedCosts: boolean;
  };
  onboarded: boolean;
};

export type LessonProgress = { lessonKey: string; status: "not-started" | "in-progress" | "completed"; progress: number; updatedAt: string };

export const DEFAULT_SETTINGS: Settings = {
  profile: { experience: "beginner", units: "in", ownedTools: ["tape-measure", "drill", "safety-glasses", "hammer", "screwdriver"] },
  ai: {
    routes: {
      text: { provider: "anthropic", model: "claude-opus-5-5" },
      reasoning: { provider: "anthropic", model: "claude-opus-5-5" },
      blueprint: { provider: "anthropic", model: "claude-opus-5-5" },
      vision: { provider: "anthropic", model: "claude-opus-5-5" },
    },
    configured: [],
    acknowledgedCosts: false,
  },
  onboarded: false,
};
