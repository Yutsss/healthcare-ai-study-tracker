import type { SupabaseClient } from '@supabase/supabase-js';
import { MILESTONE_PHASE_MAP } from './milestoneMap';
import { safeExternalUrl } from '@/lib/security/url';

export type SeedFile = {
  schema_version?: number;
  product?: string;
  roadmap: Array<{
    id: string; title: string; phase_label?: string; order?: number; provider?: string; category?: string;
    priority?: string | null; access?: string; target_competency?: string; official_source_url?: string | null;
  }>;
  course_units: Array<{ id: string; roadmap_id: string; title: string; order?: number; official_source_urls?: string[] }>;
  modules: Array<{
    id: string; roadmap_id?: string; course_unit_id: string; title: string; order?: number;
    source_type?: string; official_source_url?: string | null;
  }>;
  milestones?: Array<{ id: string; title: string; order?: number; competency_criteria?: string }>;
  starter_projects?: Array<{ id: string; title: string; type?: string; skills?: string[]; github_url?: string | null }>;
  metadata?: Record<string, unknown>;
};

export type EntityResult = { total: number; inserted: number; updated: number; skipped_manual: number; skipped_orphan: number };
export type ImportResult = {
  dryRun: boolean;
  ownerId: string;
  roadmap_items: EntityResult;
  course_units: EntityResult;
  modules: EntityResult;
  milestones: EntityResult;
  projects: EntityResult;
  warnings: string[];
};

const CHUNK = 200;

export function validateSeed(seed: unknown): asserts seed is SeedFile {
  const s = seed as Partial<SeedFile>;
  if (!s || typeof s !== 'object') throw new Error('Seed must be a JSON object');
  for (const k of ['roadmap', 'course_units', 'modules'] as const) {
    if (!Array.isArray(s[k])) throw new Error(`Seed is missing array "${k}"`);
  }
  const ids = new Set<string>();
  for (const m of s.modules!) {
    if (!m.id || !m.title || !m.course_unit_id) throw new Error(`Module missing id/title/course_unit_id: ${JSON.stringify(m).slice(0, 80)}`);
    if (ids.has(m.id)) throw new Error(`Duplicate module id ${m.id}`);
    ids.add(m.id);
  }
}

type ExistingRow = { id: string; key: string | null; manually_edited: boolean };

async function fetchExisting(admin: SupabaseClient, table: string, ownerId: string): Promise<Map<string, ExistingRow>> {
  const { data, error } = await admin.from(table).select('id,key,manually_edited').eq('owner_id', ownerId);
  if (error) throw new Error(`${table}: ${error.message}`);
  const map = new Map<string, ExistingRow>();
  for (const row of (data || []) as ExistingRow[]) if (row.key) map.set(row.key, row);
  return map;
}

/**
 * Idempotent sync: insert new keys, update existing keys unless manually_edited,
 * never delete, never touch progress. Returns key -> id map after the operation.
 */
async function syncEntity(
  admin: SupabaseClient,
  table: string,
  ownerId: string,
  rows: Array<Record<string, unknown> & { key: string }>,
  dryRun: boolean,
  result: EntityResult
): Promise<Map<string, string>> {
  const existing = await fetchExisting(admin, table, ownerId);
  const toInsert: typeof rows = [];
  const toUpdate: typeof rows = [];

  for (const row of rows) {
    const ex = existing.get(row.key);
    if (!ex) toInsert.push(row);
    else if (ex.manually_edited) result.skipped_manual++;
    else toUpdate.push({ ...row });
  }
  result.inserted += toInsert.length;
  result.updated += toUpdate.length;

  const keyToId = new Map<string, string>();
  existing.forEach((v, k) => keyToId.set(k, v.id));

  if (dryRun) {
    toInsert.forEach((r) => keyToId.set(r.key, `dry-run:${r.key}`));
    return keyToId;
  }

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const { data, error } = await admin.from(table).insert(toInsert.slice(i, i + CHUNK)).select('id,key');
    if (error) throw new Error(`${table} insert: ${error.message}`);
    for (const r of data || []) keyToId.set(r.key, r.id);
  }
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const { error } = await admin.from(table).upsert(toUpdate.slice(i, i + CHUNK), { onConflict: 'owner_id,key' });
    if (error) throw new Error(`${table} update: ${error.message}`);
  }
  return keyToId;
}

function emptyResult(total = 0): EntityResult {
  return { total, inserted: 0, updated: 0, skipped_manual: 0, skipped_orphan: 0 };
}

export async function importSeed(
  admin: SupabaseClient,
  ownerId: string,
  seed: SeedFile,
  opts: { dryRun?: boolean } = {}
): Promise<ImportResult> {
  validateSeed(seed);
  const dryRun = Boolean(opts.dryRun);
  const warnings: string[] = [];

  const res: ImportResult = {
    dryRun,
    ownerId,
    roadmap_items: emptyResult(seed.roadmap.length),
    course_units: emptyResult(seed.course_units.length),
    modules: emptyResult(seed.modules.length),
    milestones: emptyResult((seed.milestones || []).length),
    projects: emptyResult((seed.starter_projects || []).length),
    warnings,
  };

  // 1) roadmap items (phases)
  const roadmapRows = seed.roadmap.map((r, i) => ({
    owner_id: ownerId,
    key: r.id,
    title: r.title,
    phase_label: r.phase_label ?? null,
    provider: r.provider ?? null,
    category: r.category ?? null,
    priority: r.priority ?? null,
    access: r.access ?? null,
    target_competency: r.target_competency ?? null,
    source_url: safeExternalUrl(r.official_source_url),
    sort_order: r.order ?? i + 1,
  }));
  const roadmapIds = await syncEntity(admin, 'roadmap_items', ownerId, roadmapRows, dryRun, res.roadmap_items);

  // 2) course units
  const unitRows: Array<Record<string, unknown> & { key: string }> = [];
  for (const [i, u] of seed.course_units.entries()) {
    const parent = roadmapIds.get(u.roadmap_id);
    if (!parent) {
      res.course_units.skipped_orphan++;
      warnings.push(`Unit ${u.id} references unknown roadmap ${u.roadmap_id}`);
      continue;
    }
    unitRows.push({
      owner_id: ownerId,
      key: u.id,
      roadmap_item_id: parent,
      title: u.title,
      source_urls: (u.official_source_urls ?? []).map(safeExternalUrl).filter(Boolean) as string[],
      sort_order: u.order ?? i + 1,
    });
  }
  const unitIds = await syncEntity(admin, 'course_units', ownerId, unitRows, dryRun, res.course_units);

  // 3) modules
  const moduleRows: Array<Record<string, unknown> & { key: string }> = [];
  for (const [i, m] of seed.modules.entries()) {
    const parent = unitIds.get(m.course_unit_id);
    if (!parent) {
      res.modules.skipped_orphan++;
      warnings.push(`Module ${m.id} references unknown unit ${m.course_unit_id}`);
      continue;
    }
    moduleRows.push({
      owner_id: ownerId,
      key: m.id,
      course_unit_id: parent,
      title: m.title,
      source_type: m.source_type ?? null,
      source_url: safeExternalUrl(m.official_source_url),
      sort_order: m.order ?? i + 1,
    });
  }
  await syncEntity(admin, 'modules', ownerId, moduleRows, dryRun, res.modules);

  // 4) milestones
  const milestoneRows = (seed.milestones || []).map((ms, i) => ({
    owner_id: ownerId,
    key: ms.id,
    title: ms.title,
    description: ms.competency_criteria ?? null,
    sort_order: ms.order ?? i + 1,
  }));
  if (milestoneRows.length) {
    const milestoneIds = await syncEntity(admin, 'milestones', ownerId, milestoneRows, dryRun, res.milestones);
    // link milestones -> phases (idempotent upsert on the join table)
    const links: Array<{ owner_id: string; milestone_id: string; roadmap_item_id: string }> = [];
    for (const [mKey, phaseKeys] of Object.entries(MILESTONE_PHASE_MAP)) {
      const mId = milestoneIds.get(mKey);
      if (!mId) continue;
      for (const pKey of phaseKeys) {
        const pId = roadmapIds.get(pKey);
        if (!pId) { warnings.push(`Milestone ${mKey} references unknown phase ${pKey}`); continue; }
        links.push({ owner_id: ownerId, milestone_id: mId, roadmap_item_id: pId });
      }
    }
    if (!dryRun && links.length) {
      const { error } = await admin.from('milestone_roadmap_items').upsert(links, { onConflict: 'milestone_id,roadmap_item_id', ignoreDuplicates: true });
      if (error) throw new Error(`milestone_roadmap_items: ${error.message}`);
    }
  }

  // 5) starter projects
  const projectRows = (seed.starter_projects || []).map((p, i) => ({
    owner_id: ownerId,
    key: p.id,
    title: p.title,
    project_type: p.type ?? null,
    tags: p.skills ?? [],
    github_url: safeExternalUrl(p.github_url),
    sort_order: i + 1,
  }));
  if (projectRows.length) await syncEntity(admin, 'projects', ownerId, projectRows, dryRun, res.projects);

  return res;
}
