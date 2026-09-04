import { z } from 'zod';
import { DEFAULT_POMODORO } from '@/lib/focus';
import type { ModuleStatus as CurriculumModuleStatus } from '@/lib/curriculum';
import {
  DEMO_FOCUS_STORAGE_KEY,
  DEMO_STORAGE_KEY,
  LEGACY_DEMO_STORAGE_KEY,
} from './storage-keys';

export { DEMO_FOCUS_STORAGE_KEY, DEMO_STORAGE_KEY, LEGACY_DEMO_STORAGE_KEY } from './storage-keys';

const SCHEMA_VERSION = 2 as const;
const MAX_PROGRESS = 1000;
const MAX_LOGS = 200;
const MAX_REPORTS = 500;
const MAX_PROJECTS = 100;
const MAX_MARKERS = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 4000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_MINUTES = 1440;
const MAX_WEEKLY_GOAL_MINUTES = 7 * MAX_MINUTES;
const MAX_PERSISTED_RECORD_SCAN = 1000;

const moduleStatusValues = ['not_started', 'learning', 'exercise', 'done'] as const;
const projectStatusValues = ['idea', 'planned', 'in_progress', 'completed', 'archived'] as const;

export type ModuleStatus = CurriculumModuleStatus;
export type ProjectStatus = typeof projectStatusValues[number];

export type DemoModuleProgress = {
  status: ModuleStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

export type DemoSettings = {
  weeklyGoalMinutes: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
};

export type DemoLog = {
  id: string;
  loggedOn: string;
  minutes: number;
  topic: string | null;
  notes: string | null;
  moduleId: string | null;
  createdAt: string;
  source?: 'manual' | 'focus' | string;
  sessionId?: string | null;
  focusIntervals?: number;
};

export type DemoExerciseReport = {
  id: string;
  moduleId: string;
  activityTitle: string | null;
  confidence: number;
  difficulty: number;
  timeSpentMinutes: number | null;
  whatLearned: string | null;
  struggles: string | null;
  createdAt: string;
};

export type NewDemoExerciseReport = Omit<DemoExerciseReport, 'id' | 'createdAt'>;

export type DemoProject = {
  id: string;
  title: string;
  description: string | null;
  projectType: string | null;
  status: ProjectStatus;
  tags: string[];
  githubUrl: string | null;
  demoUrl: string | null;
  coverImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type DemoStarterProject = {
  id: string;
  title: string;
  type?: string;
  skills?: string[];
  github_url?: string | null;
};

export type DemoStateV2 = {
  schemaVersion: typeof SCHEMA_VERSION;
  moduleProgress: Record<string, DemoModuleProgress>;
  logs: DemoLog[];
  reports: DemoExerciseReport[];
  projects: DemoProject[];
  settings: DemoSettings;
  earnedAchievements: Record<string, string>;
  completedQuests: Record<string, string>;
};

/** Compatibility alias while the old demo screens are replaced task-by-task. */
export type DemoState = DemoStateV2;

export type DemoAction =
  | { type: 'module/status'; moduleId: string; status: ModuleStatus; now?: string }
  | { type: 'report/add'; report: DemoExerciseReport }
  | { type: 'log/add'; log: DemoLog }
  | { type: 'log/delete'; id: string }
  | { type: 'project/save'; project: DemoProject; now?: string }
  | { type: 'project/status'; id: string; status: ProjectStatus; now?: string }
  | { type: 'project/delete'; id: string }
  | { type: 'settings/update'; settings: DemoSettings }
  | { type: 'achievement/earn'; key: string; earnedAt: string }
  | { type: 'quest/complete'; key: string; completedAt: string }
  | { type: 'reset'; initial: DemoStateV2 };

export type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const v1StateSchema = z.object({
  schemaVersion: z.literal(1),
  moduleStatusOverrides: z.record(z.unknown()),
  logs: z.unknown().refine(Array.isArray, 'Expected logs array'),
  projects: z.unknown().refine(Array.isArray, 'Expected projects array'),
}).strip();

const v2StateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  moduleProgress: z.record(z.unknown()),
  logs: z.unknown().refine(Array.isArray, 'Expected logs array'),
  reports: z.unknown().refine(Array.isArray, 'Expected reports array'),
  projects: z.unknown().refine(Array.isArray, 'Expected projects array'),
  settings: z.unknown(),
  earnedAchievements: z.unknown(),
  completedQuests: z.unknown(),
}).strip();

const isModuleStatus = (value: unknown): value is ModuleStatus => moduleStatusValues.includes(value as ModuleStatus);
const isProjectStatus = (value: unknown): value is ProjectStatus => projectStatusValues.includes(value as ProjectStatus);

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maximum);
}

function requiredText(value: unknown, maximum: number): string | null {
  const text = boundedText(value, maximum);
  return text ? text : null;
}

function nullableText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined) return null;
  return boundedText(value, maximum);
}

function nullableIsoDate(value: unknown): string | null {
  const text = nullableText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function requiredIsoDate(value: unknown): string | null {
  const text = requiredText(value, 64);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function safeUrl(value: unknown): string | null {
  const text = nullableText(value, 2000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TAGS).flatMap((tag) => {
    const text = requiredText(tag, MAX_TAG_LENGTH);
    return text ? [text] : [];
  });
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function defaultSettings(): DemoSettings {
  return {
    weeklyGoalMinutes: 300,
    focusMinutes: DEFAULT_POMODORO.focusMinutes,
    shortBreakMinutes: DEFAULT_POMODORO.shortBreakMinutes,
    longBreakMinutes: DEFAULT_POMODORO.longBreakMinutes,
    longBreakEvery: DEFAULT_POMODORO.longBreakEvery,
  };
}

function sanitizeSettings(value: unknown): DemoSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const defaults = defaultSettings();
  return {
    weeklyGoalMinutes: clampInteger(source.weeklyGoalMinutes, 1, MAX_WEEKLY_GOAL_MINUTES, defaults.weeklyGoalMinutes),
    focusMinutes: clampInteger(source.focusMinutes, 1, 180, defaults.focusMinutes),
    shortBreakMinutes: clampInteger(source.shortBreakMinutes, 1, 60, defaults.shortBreakMinutes),
    longBreakMinutes: clampInteger(source.longBreakMinutes, 1, 120, defaults.longBreakMinutes),
    longBreakEvery: clampInteger(source.longBreakEvery, 1, 12, defaults.longBreakEvery),
  };
}

function sanitizeLog(value: unknown, allowedModuleIds?: Set<string>): DemoLog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const log = value as Record<string, unknown>;
  const id = requiredText(log.id, 100);
  const loggedOn = requiredText(log.loggedOn, 64);
  const createdAt = requiredIsoDate(log.createdAt);
  const minutes = log.minutes;
  if (!id || !loggedOn || !createdAt || !Number.isInteger(minutes) || typeof minutes !== 'number' || minutes < 1 || minutes > MAX_MINUTES) return null;

  const moduleId = nullableText(log.moduleId, 100);
  const source = nullableText(log.source, 20);
  const sessionId = nullableText(log.sessionId, 100);
  const focusIntervals = log.focusIntervals === undefined
    ? undefined
    : clampInteger(log.focusIntervals, 0, 100, 0);
  return {
    id,
    loggedOn,
    minutes,
    topic: nullableText(log.topic, MAX_TITLE_LENGTH),
    notes: nullableText(log.notes, MAX_NOTES_LENGTH),
    moduleId: moduleId && (!allowedModuleIds || allowedModuleIds.has(moduleId)) ? moduleId : null,
    createdAt,
    ...(source ? { source } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(focusIntervals === undefined ? {} : { focusIntervals }),
  };
}

function sanitizeReport(value: unknown, allowedModuleIds?: Set<string>): DemoExerciseReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  const id = requiredText(report.id, 100);
  const moduleId = requiredText(report.moduleId, 100);
  const createdAt = requiredIsoDate(report.createdAt);
  if (!id || !moduleId || !createdAt || (allowedModuleIds && !allowedModuleIds.has(moduleId))) return null;
  if (!Number.isInteger(report.confidence) || typeof report.confidence !== 'number' || report.confidence < 1 || report.confidence > 5) return null;
  if (!Number.isInteger(report.difficulty) || typeof report.difficulty !== 'number' || report.difficulty < 1 || report.difficulty > 5) return null;
  if (report.timeSpentMinutes !== null && report.timeSpentMinutes !== undefined) {
    if (!Number.isInteger(report.timeSpentMinutes) || typeof report.timeSpentMinutes !== 'number' || report.timeSpentMinutes < 1 || report.timeSpentMinutes > MAX_MINUTES) return null;
  }
  return {
    id,
    moduleId,
    activityTitle: nullableText(report.activityTitle, MAX_TITLE_LENGTH),
    confidence: report.confidence,
    difficulty: report.difficulty,
    timeSpentMinutes: typeof report.timeSpentMinutes === 'number' ? report.timeSpentMinutes : null,
    whatLearned: nullableText(report.whatLearned, MAX_NOTES_LENGTH),
    struggles: nullableText(report.struggles, MAX_NOTES_LENGTH),
    createdAt,
  };
}

function sanitizeProject(value: unknown): DemoProject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const project = value as Record<string, unknown>;
  const id = requiredText(project.id, 100);
  const title = requiredText(project.title, MAX_TITLE_LENGTH);
  if (!id || !title || !isProjectStatus(project.status)) return null;

  return {
    id,
    title,
    description: nullableText(project.description, MAX_NOTES_LENGTH),
    projectType: nullableText(project.projectType, 100),
    status: project.status,
    tags: sanitizeTags(project.tags),
    githubUrl: safeUrl(project.githubUrl),
    demoUrl: safeUrl(project.demoUrl),
    coverImageUrl: safeUrl(project.coverImageUrl),
    createdAt: nullableIsoDate(project.createdAt),
    updatedAt: nullableIsoDate(project.updatedAt),
    startedAt: nullableIsoDate(project.startedAt),
    completedAt: nullableIsoDate(project.completedAt),
  };
}

function sanitizeProgress(value: unknown): DemoModuleProgress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const progress = value as Record<string, unknown>;
  if (!isModuleStatus(progress.status)) return null;
  return {
    status: progress.status,
    startedAt: nullableIsoDate(progress.startedAt),
    completedAt: nullableIsoDate(progress.completedAt),
    updatedAt: nullableIsoDate(progress.updatedAt),
  };
}

function sanitizeMarkers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_PERSISTED_RECORD_SCAN);
  for (const [rawKey, rawDate] of entries) {
    if (Object.keys(result).length >= MAX_MARKERS) break;
    const key = requiredText(rawKey, 100);
    const date = requiredIsoDate(rawDate);
    if (key && date) result[key] = date;
  }
  return result;
}

function collectSanitized<T>(records: unknown[], maximum: number, sanitize: (record: unknown) => T | null): T[] {
  const collected: T[] = [];
  const scanLength = Math.min(records.length, MAX_PERSISTED_RECORD_SCAN);
  for (let index = 0; index < scanLength && collected.length < maximum; index++) {
    const clean = sanitize(records[index]);
    if (clean) collected.push(clean);
  }
  return collected;
}

function copyState(state: DemoStateV2): DemoStateV2 {
  return {
    schemaVersion: SCHEMA_VERSION,
    moduleProgress: Object.fromEntries(Object.entries(state.moduleProgress).map(([key, progress]) => [key, { ...progress }])),
    logs: state.logs.map((log) => ({ ...log })),
    reports: state.reports.map((report) => ({ ...report })),
    projects: state.projects.map((project) => ({ ...project, tags: [...project.tags] })),
    settings: { ...state.settings },
    earnedAchievements: { ...state.earnedAchievements },
    completedQuests: { ...state.completedQuests },
  };
}

function storageShape(state: DemoStateV2): DemoStateV2 {
  return copyState(state);
}

export function createDemoState(starterProjects: readonly DemoStarterProject[] = []): DemoStateV2 {
  const projects = starterProjects.slice(0, MAX_PROJECTS).flatMap((starter) => {
    const project = sanitizeProject({
      id: starter.id,
      title: starter.title,
      description: null,
      projectType: starter.type ?? null,
      status: 'idea',
      tags: starter.skills ?? [],
      githubUrl: starter.github_url ?? null,
      demoUrl: null,
      coverImageUrl: null,
      createdAt: null,
      updatedAt: null,
      startedAt: null,
      completedAt: null,
    });
    return project ? [project] : [];
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    moduleProgress: {},
    logs: [],
    reports: [],
    projects,
    settings: defaultSettings(),
    earnedAchievements: {},
    completedQuests: {},
  };
}

function parseJson(serialized: string | null): unknown {
  if (!serialized) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function migrateV1(value: z.infer<typeof v1StateSchema>, allowedModuleIds: Set<string>, starterProjects: readonly DemoStarterProject[]): DemoStateV2 {
  const moduleProgress: Record<string, DemoModuleProgress> = {};
  for (const [moduleId, status] of Object.entries(value.moduleStatusOverrides).slice(0, MAX_PROGRESS)) {
    if (allowedModuleIds.has(moduleId) && isModuleStatus(status)) {
      moduleProgress[moduleId] = { status, startedAt: null, completedAt: null, updatedAt: null };
    }
  }
  return {
    ...createDemoState(starterProjects),
    moduleProgress,
    logs: collectSanitized(value.logs as unknown[], MAX_LOGS, (log) => sanitizeLog(log, allowedModuleIds)),
    projects: collectSanitized(value.projects as unknown[], MAX_PROJECTS, sanitizeProject),
  };
}

/** Parses browser storage as untrusted data and migrates the previous local-only envelope. */
export function parseDemoState(serialized: string | null, allowedModuleIds: Set<string>, starterProjects: readonly DemoStarterProject[] = []): DemoStateV2 {
  const value = parseJson(serialized);
  if (!value) return createDemoState(starterProjects);

  const v2 = v2StateSchema.safeParse(value);
  if (v2.success) {
    const moduleProgress: Record<string, DemoModuleProgress> = {};
    for (const [moduleId, rawProgress] of Object.entries(v2.data.moduleProgress).slice(0, MAX_PROGRESS)) {
      if (!allowedModuleIds.has(moduleId)) continue;
      const progress = sanitizeProgress(rawProgress);
      if (progress) moduleProgress[moduleId] = progress;
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      moduleProgress,
      logs: collectSanitized(v2.data.logs as unknown[], MAX_LOGS, (log) => sanitizeLog(log, allowedModuleIds)),
      reports: collectSanitized(v2.data.reports as unknown[], MAX_REPORTS, (report) => sanitizeReport(report, allowedModuleIds)),
      projects: collectSanitized(v2.data.projects as unknown[], MAX_PROJECTS, sanitizeProject),
      settings: sanitizeSettings(v2.data.settings),
      earnedAchievements: sanitizeMarkers(v2.data.earnedAchievements),
      completedQuests: sanitizeMarkers(v2.data.completedQuests),
    };
  }

  const v1 = v1StateSchema.safeParse(value);
  return v1.success ? migrateV1(v1.data, allowedModuleIds, starterProjects) : createDemoState(starterProjects);
}

function actionTime(value?: string): string {
  return requiredIsoDate(value) ?? new Date().toISOString();
}

export function demoReducer(state: DemoStateV2, action: DemoAction): DemoStateV2 {
  switch (action.type) {
    case 'module/status': {
      const moduleId = requiredText(action.moduleId, 100);
      if (!moduleId || !isModuleStatus(action.status)) return state;
      if (action.status === 'not_started') {
        if (!state.moduleProgress[moduleId]) return state;
        const moduleProgress = { ...state.moduleProgress };
        delete moduleProgress[moduleId];
        return { ...state, moduleProgress };
      }
      const now = actionTime(action.now);
      const previous = state.moduleProgress[moduleId];
      const progress: DemoModuleProgress = {
        status: action.status,
        startedAt: previous?.startedAt ?? now,
        completedAt: action.status === 'done' ? previous?.completedAt ?? now : null,
        updatedAt: now,
      };
      return { ...state, moduleProgress: { ...state.moduleProgress, [moduleId]: progress } };
    }
    case 'report/add': {
      const report = sanitizeReport(action.report);
      if (!report) return state;
      return { ...state, reports: [...state.reports, report].slice(-MAX_REPORTS) };
    }
    case 'log/add': {
      const log = sanitizeLog(action.log);
      if (!log) return state;
      return { ...state, logs: [...state.logs, log].slice(-MAX_LOGS) };
    }
    case 'log/delete': {
      const logs = state.logs.filter((log) => log.id !== action.id);
      return logs.length === state.logs.length ? state : { ...state, logs };
    }
    case 'project/save': {
      const project = sanitizeProject(action.project);
      if (!project) return state;
      const index = state.projects.findIndex((current) => current.id === project.id);
      const now = actionTime(action.now);
      const previous = index >= 0 ? state.projects[index] : null;
      const saved: DemoProject = {
        ...project,
        createdAt: previous?.createdAt ?? project.createdAt ?? now,
        updatedAt: now,
        startedAt: project.status === 'in_progress' ? previous?.startedAt ?? project.startedAt ?? now : project.startedAt,
        completedAt: project.status === 'completed' ? previous?.completedAt ?? project.completedAt ?? now : project.completedAt,
      };
      if (index < 0) return { ...state, projects: [...state.projects, saved].slice(-MAX_PROJECTS) };
      return { ...state, projects: state.projects.map((current) => current.id === saved.id ? saved : current) };
    }
    case 'project/status': {
      if (!isProjectStatus(action.status)) return state;
      const index = state.projects.findIndex((project) => project.id === action.id);
      if (index < 0) return state;
      const now = actionTime(action.now);
      const current = state.projects[index];
      const updated: DemoProject = {
        ...current,
        status: action.status,
        updatedAt: now,
        startedAt: action.status === 'in_progress' ? current.startedAt ?? now : current.startedAt,
        completedAt: action.status === 'completed' ? current.completedAt ?? now : action.status === 'archived' ? current.completedAt : null,
      };
      return { ...state, projects: state.projects.map((project, currentIndex) => currentIndex === index ? updated : project) };
    }
    case 'project/delete': {
      const projects = state.projects.filter((project) => project.id !== action.id);
      return projects.length === state.projects.length ? state : { ...state, projects };
    }
    case 'settings/update':
      return { ...state, settings: sanitizeSettings(action.settings) };
    case 'achievement/earn': {
      const key = requiredText(action.key, 100);
      const earnedAt = requiredIsoDate(action.earnedAt);
      if (!key || !earnedAt || state.earnedAchievements[key]) return state;
      return { ...state, earnedAchievements: { ...state.earnedAchievements, [key]: earnedAt } };
    }
    case 'quest/complete': {
      const key = requiredText(action.key, 100);
      const completedAt = requiredIsoDate(action.completedAt);
      if (!key || !completedAt || state.completedQuests[key]) return state;
      return { ...state, completedQuests: { ...state.completedQuests, [key]: completedAt } };
    }
    case 'reset':
      return copyState(action.initial);
  }
}

export function calculateDemoStats(state: DemoStateV2): { completedModules: number; totalMinutes: number; completedProjects: number; xp: number } {
  const completedModules = Object.values(state.moduleProgress).filter((progress) => progress.status === 'done').length;
  const totalMinutes = state.logs.reduce((total, log) => total + log.minutes, 0);
  const completedProjects = state.projects.filter((project) => project.status === 'completed').length;
  const logXp = state.logs.reduce((total, log) => total + Math.min(30, Math.max(1, Math.ceil(log.minutes / 10))), 0);
  return { completedModules, totalMinutes, completedProjects, xp: completedModules * 20 + logXp + completedProjects * 150 };
}

export function loadDemoState(storage: DemoStorage, allowedModuleIds: Set<string>, starterProjects: readonly DemoStarterProject[] = []): DemoStateV2 {
  const current = storage.getItem(DEMO_STORAGE_KEY);
  if (current !== null) return parseDemoState(current, allowedModuleIds, starterProjects);
  return parseDemoState(storage.getItem(LEGACY_DEMO_STORAGE_KEY), allowedModuleIds, starterProjects);
}

export function saveDemoState(storage: DemoStorage, state: DemoStateV2): void {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(storageShape(state)));
}

export function resetDemoState(storage: DemoStorage): void {
  storage.removeItem(DEMO_STORAGE_KEY);
  storage.removeItem(LEGACY_DEMO_STORAGE_KEY);
  storage.removeItem(DEMO_FOCUS_STORAGE_KEY);
}
