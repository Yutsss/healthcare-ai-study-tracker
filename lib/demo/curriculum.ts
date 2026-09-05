import {
  buildTree,
  type CurriculumRaw,
  type CurriculumTree,
} from '@/lib/curriculum';
import { safeExternalUrl } from '@/lib/security/url';
import type { SeedFile } from '@/lib/seed/importSeed';
import type { DemoStateV2 } from './state';

export function buildDemoCurriculum(
  seed: SeedFile,
  progress: DemoStateV2['moduleProgress'],
): CurriculumTree {
  const roadmap: CurriculumRaw['roadmap'] = seed.roadmap.map((item, index) => ({
    id: item.id,
    key: item.id,
    title: item.title,
    phase_label: item.phase_label ?? null,
    description: null,
    provider: item.provider ?? null,
    category: item.category ?? null,
    priority: item.priority ?? null,
    access: item.access ?? null,
    target_competency: item.target_competency ?? null,
    source_url: safeExternalUrl(item.official_source_url),
    sort_order: item.order ?? index + 1,
    manually_edited: false,
    archived_at: null,
  }));

  const units: CurriculumRaw['units'] = seed.course_units.map((unit, index) => ({
    id: unit.id,
    key: unit.id,
    roadmap_item_id: unit.roadmap_id,
    title: unit.title,
    description: null,
    source_urls: (unit.official_source_urls ?? []).map(safeExternalUrl).filter((url): url is string => Boolean(url)),
    sort_order: unit.order ?? index + 1,
    manually_edited: false,
    archived_at: null,
  }));

  const modules: CurriculumRaw['modules'] = seed.modules.map((module, index) => ({
    id: module.id,
    key: module.id,
    course_unit_id: module.course_unit_id,
    title: module.title,
    description: null,
    source_type: module.source_type ?? null,
    source_url: safeExternalUrl(module.official_source_url),
    estimated_minutes: null,
    xp_value: 20,
    sort_order: module.order ?? index + 1,
    manually_edited: false,
    archived_at: null,
  }));

  const knownModuleIds = new Set(modules.map((module) => module.id));
  const progressRows: CurriculumRaw['progress'] = Object.entries(progress).flatMap(([moduleId, item]) => {
    if (!knownModuleIds.has(moduleId)) return [];
    return [{
      id: `demo-progress:${moduleId}`,
      module_id: moduleId,
      status: item.status,
      started_at: item.startedAt,
      completed_at: item.completedAt,
      notes: null,
      updated_at: item.updatedAt ?? undefined,
    }];
  });

  return buildTree({ roadmap, units, modules, progress: progressRows });
}
