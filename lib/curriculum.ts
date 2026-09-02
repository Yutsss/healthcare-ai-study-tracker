export type ModuleStatus = 'not_started' | 'learning' | 'exercise' | 'done';
export const MODULE_STATUSES: ModuleStatus[] = ['not_started', 'learning', 'exercise', 'done'];

export const STATUS_META: Record<ModuleStatus, { label: string; weight: number; hint: string }> = {
  not_started: { label: 'Not started', weight: 0, hint: 'Queued' },
  learning: { label: 'Learning', weight: 0.25, hint: 'Watching / reading' },
  exercise: { label: 'Exercise', weight: 0.75, hint: 'Practicing / labs' },
  done: { label: 'Done', weight: 1, hint: 'Completed' },
};

export type NodeStatus = 'not_started' | 'in_progress' | 'completed';

export type RoadmapRow = {
  id: string; key: string; title: string; phase_label: string | null; description: string | null;
  provider: string | null; category: string | null; priority: string | null; access: string | null;
  target_competency: string | null; source_url: string | null; sort_order: number;
  manually_edited: boolean; archived_at: string | null;
};
export type UnitRow = {
  id: string; key: string; roadmap_item_id: string; title: string; description: string | null;
  source_urls: string[]; sort_order: number; manually_edited: boolean; archived_at: string | null;
};
export type ModuleRow = {
  id: string; key: string; course_unit_id: string; title: string; description: string | null;
  source_type: string | null; source_url: string | null; estimated_minutes: number | null; xp_value: number;
  sort_order: number; manually_edited: boolean; archived_at: string | null;
};
export type ProgressRow = {
  id: string; module_id: string; status: ModuleStatus; started_at: string | null; completed_at: string | null; notes: string | null;
  updated_at?: string;
};

export type CurriculumRaw = { roadmap: RoadmapRow[]; units: UnitRow[]; modules: ModuleRow[]; progress: ProgressRow[] };

export type ModuleNode = ModuleRow & { status: ModuleStatus; progress: ProgressRow | null };
export type UnitNode = UnitRow & { modules: ModuleNode[]; total: number; done: number; weighted: number; percent: number; status: NodeStatus };
export type PhaseNode = RoadmapRow & { units: UnitNode[]; total: number; done: number; weighted: number; percent: number; status: NodeStatus; index: number };

export type ContinueTarget = { module: ModuleNode; unit: UnitNode; phase: PhaseNode } | null;

export type CurriculumTree = {
  phases: PhaseNode[];
  totals: {
    phases: number; phasesDone: number; phasesInProgress: number;
    units: number; unitsDone: number;
    modules: number; modulesDone: number; modulesInProgress: number;
    weightedPercent: number;
  };
  continueTarget: ContinueTarget;
};

function nodeStatus(total: number, done: number, weighted: number): NodeStatus {
  if (total === 0) return 'not_started';
  if (done === total) return 'completed';
  if (weighted > 0) return 'in_progress';
  return 'not_started';
}

const bySort = <T extends { sort_order: number; title: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.title.localeCompare(b.title);

export function buildTree(raw: CurriculumRaw): CurriculumTree {
  const progressByModule = new Map<string, ProgressRow>();
  for (const p of raw.progress || []) progressByModule.set(p.module_id, p);

  const modulesByUnit = new Map<string, ModuleNode[]>();
  for (const m of raw.modules || []) {
    if (m.archived_at) continue;
    const p = progressByModule.get(m.id) || null;
    const node: ModuleNode = { ...m, status: p?.status ?? 'not_started', progress: p };
    const arr = modulesByUnit.get(m.course_unit_id) || [];
    arr.push(node);
    modulesByUnit.set(m.course_unit_id, arr);
  }

  const unitsByPhase = new Map<string, UnitNode[]>();
  for (const u of raw.units || []) {
    if (u.archived_at) continue;
    const modules = (modulesByUnit.get(u.id) || []).sort(bySort);
    const total = modules.length;
    const done = modules.filter((m) => m.status === 'done').length;
    const weighted = modules.reduce((s, m) => s + STATUS_META[m.status].weight, 0);
    const node: UnitNode = {
      ...u, modules, total, done, weighted,
      percent: total ? Math.round((weighted / total) * 100) : 0,
      status: nodeStatus(total, done, weighted),
    };
    const arr = unitsByPhase.get(u.roadmap_item_id) || [];
    arr.push(node);
    unitsByPhase.set(u.roadmap_item_id, arr);
  }

  const phases: PhaseNode[] = (raw.roadmap || [])
    .filter((r) => !r.archived_at)
    .sort(bySort)
    .map((r, i) => {
      const units = (unitsByPhase.get(r.id) || []).sort(bySort);
      const total = units.reduce((s, u) => s + u.total, 0);
      const done = units.reduce((s, u) => s + u.done, 0);
      const weighted = units.reduce((s, u) => s + u.weighted, 0);
      return {
        ...r, units, total, done, weighted, index: i + 1,
        percent: total ? Math.round((weighted / total) * 100) : 0,
        status: nodeStatus(total, done, weighted),
      };
    });

  const allModules = phases.flatMap((p) => p.units.flatMap((u) => u.modules));
  const totalModules = allModules.length;
  const modulesDone = allModules.filter((m) => m.status === 'done').length;
  const modulesInProgress = allModules.filter((m) => m.status === 'learning' || m.status === 'exercise').length;
  const weightedSum = allModules.reduce((s, m) => s + STATUS_META[m.status].weight, 0);
  const allUnits = phases.flatMap((p) => p.units);

  let continueTarget: ContinueTarget = null;
  outer: for (const phase of phases) {
    for (const unit of phase.units) {
      for (const module of unit.modules) {
        if (module.status === 'learning' || module.status === 'exercise') { continueTarget = { module, unit, phase }; break outer; }
      }
    }
  }
  if (!continueTarget) {
    outer2: for (const phase of phases) {
      for (const unit of phase.units) {
        for (const module of unit.modules) {
          if (module.status === 'not_started') { continueTarget = { module, unit, phase }; break outer2; }
        }
      }
    }
  }

  return {
    phases,
    totals: {
      phases: phases.length,
      phasesDone: phases.filter((p) => p.status === 'completed').length,
      phasesInProgress: phases.filter((p) => p.status === 'in_progress').length,
      units: allUnits.length,
      unitsDone: allUnits.filter((u) => u.status === 'completed').length,
      modules: totalModules,
      modulesDone,
      modulesInProgress,
      weightedPercent: totalModules ? Math.round((weightedSum / totalModules) * 100) : 0,
    },
    continueTarget,
  };
}
