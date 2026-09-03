import { z } from 'zod';

export const DEMO_STORAGE_KEY = 'yl-guest-demo:v1';

const SCHEMA_VERSION = 1;
const MAX_LOGS = 200;
const MAX_PROJECTS = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 4000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_MINUTES = 1440;
const MAX_PERSISTED_RECORD_SCAN = 1000;

const moduleStatusValues = ['not_started', 'learning', 'exercise', 'done'] as const;
const projectStatusValues = ['idea', 'planned', 'in_progress', 'completed', 'archived'] as const;

export type ModuleStatus = typeof moduleStatusValues[number];
export type ProjectStatus = typeof projectStatusValues[number];

export type DemoLog = {
  id: string;
  loggedOn: string;
  minutes: number;
  topic: string | null;
  notes: string | null;
  moduleId: string | null;
  createdAt: string;
};

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
};

export type DemoStarterProject = {
  id: string;
  title: string;
  type?: string;
  skills?: string[];
  github_url?: string | null;
};

export type DemoState = {
  schemaVersion: typeof SCHEMA_VERSION;
  moduleStatusOverrides: Record<string, ModuleStatus>;
  logs: DemoLog[];
  projects: DemoProject[];
};

export type DemoAction =
  | { type: 'module/status'; moduleId: string; status: ModuleStatus }
  | { type: 'log/add'; log: DemoLog }
  | { type: 'log/delete'; id: string }
  | { type: 'project/save'; project: DemoProject }
  | { type: 'project/status'; id: string; status: ProjectStatus }
  | { type: 'project/delete'; id: string }
  | { type: 'reset'; initial: DemoState };

export type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storedStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  moduleStatusOverrides: z.record(z.unknown()),
  logs: z.unknown().refine(Array.isArray, 'Expected logs array'),
  projects: z.unknown().refine(Array.isArray, 'Expected projects array'),
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
  return value
    .slice(0, MAX_TAGS)
    .flatMap((tag) => {
      const text = requiredText(tag, MAX_TAG_LENGTH);
      return text ? [text] : [];
    });
}

function sanitizeLog(value: unknown, allowedModuleIds?: Set<string>): DemoLog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const log = value as Record<string, unknown>;
  const id = requiredText(log.id, 100);
  const loggedOn = requiredText(log.loggedOn, 64);
  const createdAt = requiredText(log.createdAt, 64);
  const minutes = log.minutes;
  if (!id || !loggedOn || !createdAt || !Number.isInteger(minutes) || typeof minutes !== 'number' || minutes < 1 || minutes > MAX_MINUTES) return null;

  const moduleId = nullableText(log.moduleId, 100);
  return {
    id,
    loggedOn,
    minutes,
    topic: nullableText(log.topic, MAX_TITLE_LENGTH),
    notes: nullableText(log.notes, MAX_NOTES_LENGTH),
    moduleId: moduleId && (!allowedModuleIds || allowedModuleIds.has(moduleId)) ? moduleId : null,
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
  };
}

/**
 * Browser storage is untrusted: inspect a fixed number of raw records, then
 * retain up to the collection's output limit. Invalid records do not consume
 * the output limit, but nothing beyond the scan limit is semantically parsed.
 */
function collectSanitized<T>(records: unknown[], maximum: number, sanitize: (record: unknown) => T | null): T[] {
  const collected: T[] = [];
  const scanLength = Math.min(records.length, MAX_PERSISTED_RECORD_SCAN);
  for (let index = 0; index < scanLength && collected.length < maximum; index++) {
    const clean = sanitize(records[index]);
    if (clean) collected.push(clean);
  }
  return collected;
}

function copyState(state: DemoState): DemoState {
  return {
    schemaVersion: SCHEMA_VERSION,
    moduleStatusOverrides: { ...state.moduleStatusOverrides },
    logs: state.logs.map((log) => ({ ...log })),
    projects: state.projects.map((project) => ({ ...project, tags: [...project.tags] })),
  };
}

function storageShape(state: DemoState): DemoState {
  return copyState(state);
}

export function createDemoState(starterProjects: readonly DemoStarterProject[] = []): DemoState {
  const projects = starterProjects
    .slice(0, MAX_PROJECTS)
    .flatMap((starter) => {
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
      });
      return project ? [project] : [];
    });

  return { schemaVersion: SCHEMA_VERSION, moduleStatusOverrides: {}, logs: [], projects };
}

/** Parses browser storage as untrusted data and returns an empty state for an obsolete or invalid envelope. */
export function parseDemoState(serialized: string | null, allowedModuleIds: Set<string>): DemoState {
  if (!serialized) return createDemoState();

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return createDemoState();
  }

  const parsed = storedStateSchema.safeParse(value);
  if (!parsed.success) return createDemoState();

  const moduleStatusOverrides: Record<string, ModuleStatus> = {};
  for (const [moduleId, status] of Object.entries(parsed.data.moduleStatusOverrides)) {
    if (allowedModuleIds.has(moduleId) && isModuleStatus(status)) moduleStatusOverrides[moduleId] = status;
  }

  const logs = collectSanitized(parsed.data.logs as unknown[], MAX_LOGS, (log) => sanitizeLog(log, allowedModuleIds));
  const projects = collectSanitized(parsed.data.projects as unknown[], MAX_PROJECTS, sanitizeProject);

  return { schemaVersion: SCHEMA_VERSION, moduleStatusOverrides, logs, projects };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'module/status': {
      const moduleId = requiredText(action.moduleId, 100);
      if (!moduleId || !isModuleStatus(action.status)) return state;
      return { ...state, moduleStatusOverrides: { ...state.moduleStatusOverrides, [moduleId]: action.status } };
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
      if (index < 0) return { ...state, projects: [...state.projects, project].slice(-MAX_PROJECTS) };
      const projects = state.projects.map((current) => current.id === project.id ? project : current);
      return { ...state, projects };
    }
    case 'project/status': {
      if (!isProjectStatus(action.status)) return state;
      const projects = state.projects.map((project) => project.id === action.id ? { ...project, status: action.status } : project);
      return projects.some((project, index) => project !== state.projects[index]) ? { ...state, projects } : state;
    }
    case 'project/delete': {
      const projects = state.projects.filter((project) => project.id !== action.id);
      return projects.length === state.projects.length ? state : { ...state, projects };
    }
    case 'reset':
      return copyState(action.initial);
  }
}

export function calculateDemoStats(state: DemoState): { completedModules: number; totalMinutes: number; completedProjects: number; xp: number } {
  const completedModules = Object.values(state.moduleStatusOverrides).filter((status) => status === 'done').length;
  const totalMinutes = state.logs.reduce((total, log) => total + log.minutes, 0);
  const completedProjects = state.projects.filter((project) => project.status === 'completed').length;
  const logXp = state.logs.reduce((total, log) => total + Math.min(30, Math.max(1, Math.ceil(log.minutes / 10))), 0);
  return { completedModules, totalMinutes, completedProjects, xp: completedModules * 20 + logXp + completedProjects * 150 };
}

export function loadDemoState(storage: DemoStorage, allowedModuleIds: Set<string>): DemoState {
  return parseDemoState(storage.getItem(DEMO_STORAGE_KEY), allowedModuleIds);
}

export function saveDemoState(storage: DemoStorage, state: DemoState): void {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(storageShape(state)));
}

export function resetDemoState(storage: DemoStorage): void {
  storage.removeItem(DEMO_STORAGE_KEY);
}
