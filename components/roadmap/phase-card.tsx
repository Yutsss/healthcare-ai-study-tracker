'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardPen, ExternalLink, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_META, type ModuleNode, type ModuleStatus, type UnitNode, type PhaseNode } from '@/lib/curriculum';
import { StatusControl, STATUS_ICON, STATUS_TEXT_CLASS } from './status-control';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { safeExternalUrl } from '@/lib/security/url';
import { phaseTone } from '@/lib/fun-roadmap';

export type StatusHandler = (module: ModuleNode, status: ModuleStatus) => void;
export type ReportHandler = (module: ModuleNode, unit: UnitNode, phase?: PhaseNode) => void;

export function ModuleRow({ module, onStatus, onReport, reportCount = 0, busy }: { module: ModuleNode; onStatus: StatusHandler; onReport?: () => void; reportCount?: number; busy?: boolean }) {
  const Icon = STATUS_ICON[module.status];
  const done = module.status === 'done';
  return (
    <div className="group/module flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-background/80" data-testid={`module-${module.key}`}>
      <Icon className={cn('h-4 w-4 shrink-0', STATUS_TEXT_CLASS[module.status])} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-tight', done && 'line-through text-muted-foreground')}>{module.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {module.xp_value} XP
          {module.progress?.completed_at && done ? ` · done ${format(new Date(module.progress.completed_at), 'MMM d')}` : ` · ${STATUS_META[module.status].hint}`}
        </p>
      </div>
      {safeExternalUrl(module.source_url) && (
        <a href={safeExternalUrl(module.source_url)!} target="_blank" rel="noopener noreferrer" aria-label={`Open official source for ${module.title}`} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Open official source">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {onReport && (
        <button type="button" onClick={onReport} aria-label={`Log an exercise self-report for ${module.title}`} title="Log an exercise self-report" data-testid={`report-${module.key}`}
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-sm">
          <ClipboardPen className="h-3.5 w-3.5" />
          {reportCount > 0 && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground leading-4 min-w-4 text-center">{reportCount}</span>}
        </button>
      )}
      <StatusControl value={module.status} onChange={(s) => onStatus(module, s)} disabled={busy} moduleKey={module.key} />
    </div>
  );
}

export function UnitRow({ unit, phase, onStatus, onReport, reportCounts, defaultOpen, forceOpen, busy }: { unit: UnitNode; phase?: PhaseNode; onStatus: StatusHandler; onReport?: ReportHandler; reportCounts?: Map<string, number>; defaultOpen?: boolean; forceOpen?: boolean; busy?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const isOpen = forceOpen || open;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const link = safeExternalUrl(unit.source_urls?.[0]);
  return (
    <div className="overflow-hidden rounded-xl border bg-background/75 shadow-sm transition-shadow hover:shadow-md" data-testid={`unit-${unit.key}`}>
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left">
          <Chevron className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold truncate', unit.status === 'completed' && 'text-emerald-700 dark:text-emerald-300')}>{unit.title}</p>
              {unit.status === 'completed' && <Badge className="bg-emerald-600 hover:bg-emerald-600">Done</Badge>}
              {unit.status === 'in_progress' && <Badge variant="secondary" className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">In progress</Badge>}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <Progress value={unit.percent} className={cn('h-1.5 w-40', unit.status === 'completed' ? '[&>div]:bg-emerald-500' : '[&>div]:bg-sky-500')} />
              <span className="text-[11px] text-muted-foreground">{unit.done}/{unit.total} modules · {unit.percent}%</span>
            </div>
          </div>
        </button>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${unit.title} on Coursera`} className="mr-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Open on Coursera">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {isOpen && (
        <div className="border-t bg-muted/20 px-2 py-1.5 space-y-0.5">
          {unit.modules.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No modules in this course yet.</p>}
          {unit.modules.map((m) => <ModuleRow key={m.id} module={m} onStatus={onStatus} busy={busy} reportCount={reportCounts?.get(m.id) || 0} onReport={onReport ? () => onReport(m, unit, phase) : undefined} />)}
        </div>
      )}
    </div>
  );
}

export function PhaseCard({
  phase, open, onToggle, onStatus, onReport, reportCounts, openUnitIds, forceOpenUnits, busy,
}: {
  phase: PhaseNode; open: boolean; onToggle: () => void; onStatus: StatusHandler; onReport?: ReportHandler; reportCounts?: Map<string, number>;
  openUnitIds?: Set<string>; forceOpenUnits?: boolean; busy?: boolean;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const tone = phaseTone(phase.index, phase.status);

  return (
    <section id={`phase-${phase.key}`} className={cn('card-lift group relative overflow-hidden rounded-2xl border shadow-sm', tone.surface)} data-testid={`phase-${phase.key}`}>
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90', tone.accent)} />
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left p-4 pt-5 md:p-5 md:pt-6">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-lg transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105', tone.icon)}>
            {phase.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : phase.index}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={cn('text-[11px] font-extrabold uppercase tracking-[0.14em]', tone.text)}>{phase.phase_label || `Phase ${phase.index}`}</p>
              {phase.status === 'in_progress' && <Sparkles className={cn('h-3 w-3 animate-float', tone.text)} />}
            </div>
            <h3 className="font-bold leading-snug">{phase.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {phase.provider && <Badge variant="outline" className="bg-background/55">{phase.provider}</Badge>}
              {phase.category && <Badge variant="outline" className={tone.soft}>{phase.category}</Badge>}
              {phase.priority && <Badge className="bg-rose-600 hover:bg-rose-600 dark:bg-rose-500">{phase.priority}</Badge>}
              {phase.access && <Badge variant="outline" className="bg-background/55 text-muted-foreground">{phase.access}</Badge>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-2xl font-black tabular-nums', tone.text)}>{phase.percent}%</p>
            <p className="text-[11px] text-muted-foreground">{phase.done}/{phase.total} modules</p>
          </div>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 shadow-sm">
            <Chevron className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>
        <Progress value={phase.percent} className={cn('mt-4 h-2.5 bg-background/70', tone.progress)} />
      </button>

      {open && (
        <div className="border-t bg-white/35 p-3 dark:bg-black/10 md:p-4 space-y-3">
          {phase.target_competency && (
            <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Target competency:</span> {phase.target_competency}</p>
          )}
          <div className="space-y-2">
            {phase.units.length === 0 && <p className="text-sm text-muted-foreground">No courses in this phase yet.</p>}
            {phase.units.map((u) => (
              <UnitRow key={u.id} unit={u} phase={phase} onStatus={onStatus} onReport={onReport} reportCounts={reportCounts} busy={busy} defaultOpen={openUnitIds?.has(u.id)} forceOpen={forceOpenUnits} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
