'use client';

import { useMemo } from 'react';
import { Lock, Sparkles, Star } from 'lucide-react';
import type { CurriculumTree, PhaseNode } from '@/lib/curriculum';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SkillNode = {
  category: string;
  phases: PhaseNode[];
  units: number; unitsDone: number;
  modules: number; modulesDone: number;
  percent: number;
  state: 'mastered' | 'active' | 'dormant';
  order: number;
};

function deriveSkills(tree: CurriculumTree | null): SkillNode[] {
  if (!tree) return [];
  const map = new Map<string, SkillNode>();
  for (const p of tree.phases) {
    const cat = p.category || 'General';
    const n = map.get(cat) || { category: cat, phases: [], units: 0, unitsDone: 0, modules: 0, modulesDone: 0, percent: 0, state: 'dormant', order: p.index };
    n.phases.push(p);
    n.units += p.units.length;
    n.unitsDone += p.units.filter((u) => u.status === 'completed').length;
    n.modules += p.total;
    n.modulesDone += p.done;
    map.set(cat, n);
  }
  return Array.from(map.values()).map((n) => {
    const weighted = n.phases.reduce((s, p) => s + p.weighted, 0);
    const percent = n.modules ? Math.round((weighted / n.modules) * 100) : 0;
    const state: SkillNode['state'] = n.modules > 0 && n.modulesDone === n.modules ? 'mastered' : percent > 0 ? 'active' : 'dormant';
    return { ...n, percent, state };
  }).sort((a, b) => a.order - b.order);
}

function Ring({ percent, state }: { percent: number; state: SkillNode['state'] }) {
  const size = 64, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = state === 'mastered' ? 'text-emerald-500' : state === 'active' ? 'text-primary' : 'text-muted-foreground/40';
  return (
    <div className={cn('relative shrink-0', color)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-foreground">
        {state === 'mastered' ? <Star className="h-5 w-5 fill-emerald-500 text-emerald-500" /> : state === 'dormant' ? <Lock className="h-4 w-4 text-muted-foreground" /> : <span className="text-xs font-bold tabular-nums">{percent}%</span>}
      </div>
    </div>
  );
}

export function SkillTree({ tree }: { tree: CurriculumTree | null }) {
  const skills = useMemo(() => deriveSkills(tree), [tree]);
  const mastered = skills.filter((s) => s.state === 'mastered').length;
  return (
    <Card data-testid="skill-tree">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Skill tree</CardTitle>
        <CardDescription>{mastered}/{skills.length} skills mastered. Each skill fills in automatically as you complete its courses — from Python to Medical AI.</CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 && <p className="text-sm text-muted-foreground">Import the curriculum to grow your skill tree.</p>}
        <ol className="relative border-l-2 border-dashed border-border ml-8 space-y-4">
          {skills.map((s, i) => (
            <li key={s.category} className="relative pl-8" data-testid={`skill-${s.category.toLowerCase().replace(/\s+/g, '-')}`}>
              <span className={cn('absolute -left-[9px] top-6 h-4 w-4 rounded-full border-2 bg-background',
                s.state === 'mastered' ? 'border-emerald-500 bg-emerald-500' : s.state === 'active' ? 'border-primary' : 'border-muted-foreground/40')} />
              <div className={cn('rounded-xl border p-3 md:p-4 flex gap-4 items-center transition-colors',
                s.state === 'mastered' ? 'border-emerald-200 bg-emerald-50/60' : s.state === 'active' ? 'border-primary/30 bg-card' : 'bg-muted/30')}>
                <Ring percent={s.percent} state={s.state} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('font-semibold', s.state === 'dormant' && 'text-muted-foreground')}>{s.category}</p>
                    <span className="text-[11px] text-muted-foreground">Tier {i + 1}</span>
                    {s.state === 'mastered' && <span className="text-[11px] font-semibold text-emerald-700">Mastered</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.unitsDone}/{s.units} courses · {s.modulesDone}/{s.modules} modules</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.phases.map((p) => (
                      <span key={p.id} title={`${p.title} — ${p.percent}%`}
                        className={cn('rounded-full border px-2 py-0.5 text-[11px]',
                          p.status === 'completed' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : p.status === 'in_progress' ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground')}>
                        {(p.phase_label || p.title).replace(/\s+—.*$/, '')} · {p.percent}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
