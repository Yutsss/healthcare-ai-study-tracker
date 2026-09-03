'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardPen, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_META, type ModuleNode, type ModuleStatus, type UnitNode, type PhaseNode } from '@/lib/curriculum';
import { StatusControl, STATUS_ICON, STATUS_TEXT_CLASS } from './status-control';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type StatusHandler = (module: ModuleNode, status: ModuleStatus) => void;
export type ReportHandler = (module: ModuleNode, unit: UnitNode, phase?: PhaseNode) => void;

export function ModuleRow({ module, onStatus, onReport, reportCount = 0, busy }: { module: ModuleNode; onStatus: StatusHandler; onReport?: () => void; reportCount?: number; busy?: boolean }) {
  const Icon = STATUS_ICON[module.status];
  const done = module.status === 'done';
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60" data-testid={`module-${module.key}`}>
      <Icon className={cn('h-4 w-4 shrink-0', STATUS_TEXT_CLASS[module.status])} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-tight', done && 'line-through text-muted-foreground')}>{module.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {module.xp_value} XP
          {module.progress?.completed_at && done ? ` · done ${format(new Date(module.progress.completed_at), 'MMM d')}` : ` · ${STATUS_META[module.status].hint}`}
        </p>
      </div>
      {module.source_url && (
        <a href={module.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title="Open official source">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {onReport && (
        <button type="button" onClick={onReport} title="Log an exercise self-report" data-testid={`report-${module.key}`}
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground">
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
  const link = unit.source_urls?.[0];
  return (
    <div className="rounded-lg border bg-background" data-testid={`unit-${unit.key}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <Chevron className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-medium truncate', unit.status === 'completed' && 'text-emerald-700')}>{unit.title}</p>
            {unit.status === 'completed' && <Badge className="bg-emerald-600 hover:bg-emerald-600">Done</Badge>}
            {unit.status === 'in_progress' && <Badge variant="secondary">In progress</Badge>}
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <Progress value={unit.percent} className="h-1.5 w-40" />
            <span className="text-[11px] text-muted-foreground">{unit.done}/{unit.total} modules · {unit.percent}%</span>
          </div>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground" title="Open on Coursera">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </button>
      {isOpen && (
        <div className="border-t px-2 py-1.5 space-y-0.5">
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
  const statusStyles = {
    completed: 'border-emerald-200 bg-emerald-50/60',
    in_progress: 'border-primary/30 bg-card',
    not_started: 'bg-card',
  }[phase.status];

  return (
    <section id={`phase-${phase.key}`} className={cn('rounded-xl border shadow-sm', statusStyles)} data-testid={`phase-${phase.key}`}>
      <button type="button" onClick={onToggle} className="w-full text-left p-4 md:p-5">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
            phase.status === 'completed' ? 'bg-emerald-600 text-white' : phase.status === 'in_progress' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {phase.index}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{phase.phase_label || `Phase ${phase.index}`}</p>
            <h3 className="font-semibold leading-snug">{phase.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {phase.provider && <Badge variant="outline">{phase.provider}</Badge>}
              {phase.category && <Badge variant="secondary">{phase.category}</Badge>}
              {phase.priority && <Badge className="bg-rose-600 hover:bg-rose-600">{phase.priority}</Badge>}
              {phase.access && <Badge variant="outline" className="text-muted-foreground">{phase.access}</Badge>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums">{phase.percent}%</p>
            <p className="text-[11px] text-muted-foreground">{phase.done}/{phase.total} modules</p>
          </div>
          <Chevron className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
        </div>
        <Progress value={phase.percent} className="mt-4 h-2" />
      </button>

      {open && (
        <div className="border-t p-3 md:p-4 space-y-3">
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
