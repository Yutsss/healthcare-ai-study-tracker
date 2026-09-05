'use client';

import React from 'react';
import { BookOpen, CheckCircle2, Circle, PenLine } from 'lucide-react';
import { MODULE_STATUSES, STATUS_META, type ModuleStatus } from '@/lib/curriculum';
import { cn } from '@/lib/utils';

export const STATUS_ICON = { not_started: Circle, learning: BookOpen, exercise: PenLine, done: CheckCircle2 } as const;

export const STATUS_ACTIVE_CLASS: Record<ModuleStatus, string> = {
  not_started: 'bg-secondary text-secondary-foreground border-transparent',
  learning: 'bg-sky-500 text-white border-sky-500',
  exercise: 'bg-amber-500 text-white border-amber-500',
  done: 'bg-emerald-600 text-white border-emerald-600',
};

export const STATUS_TEXT_CLASS: Record<ModuleStatus, string> = {
  not_started: 'text-muted-foreground',
  learning: 'text-sky-600',
  exercise: 'text-amber-600',
  done: 'text-emerald-600',
};

export function StatusControl({
  value,
  onChange,
  disabled,
  moduleKey,
}: {
  value: ModuleStatus;
  onChange: (s: ModuleStatus) => void;
  disabled?: boolean;
  moduleKey?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Module status" className="inline-flex rounded-md border bg-background p-0.5 shadow-sm">
      {MODULE_STATUSES.map((s) => {
        const Icon = STATUS_ICON[s];
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={`${STATUS_META[s].label} — ${STATUS_META[s].hint}`}
            data-testid={moduleKey ? `status-${s}-${moduleKey}` : undefined}
            onClick={() => !active && onChange(s)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors',
              active ? STATUS_ACTIVE_CLASS[s] : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{STATUS_META[s].label}</span>
          </button>
        );
      })}
    </div>
  );
}
