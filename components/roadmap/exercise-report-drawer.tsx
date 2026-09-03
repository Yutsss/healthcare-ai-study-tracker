'use client';

import { FormEvent, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Brain, Clock, Loader2, Mountain, Sparkles } from 'lucide-react';
import type { ModuleNode, ModuleStatus } from '@/lib/curriculum';
import { STATUS_META } from '@/lib/curriculum';
import { EXERCISE_REPORT_XP, useCreateExerciseReport, useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { useSetModuleStatus } from '@/lib/hooks/useCurriculum';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ReportContext = { module: ModuleNode; unitTitle?: string; phaseLabel?: string | null } | null;

const CONFIDENCE_LABELS = ['Lost', 'Shaky', 'Getting there', 'Confident', 'Could teach it'];
const DIFFICULTY_LABELS = ['Trivial', 'Easy', 'Moderate', 'Hard', 'Brutal'];
const TIME_CHIPS = [15, 30, 45, 60, 90];

type AfterStatus = 'keep' | 'exercise' | 'done';

function Scale({
  value, onChange, labels, name, tone,
}: { value: number; onChange: (v: number) => void; labels: string[]; name: string; tone: string }) {
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            data-testid={`${name}-${n}`}
            onClick={() => onChange(n)}
            className={cn(
              'h-10 rounded-md border text-sm font-semibold transition-colors',
              value === n ? tone : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground h-4">{value ? labels[value - 1] : 'Pick a value from 1 to 5'}</p>
    </div>
  );
}

export function ExerciseReportDrawer({ context, onClose }: { context: ReportContext; onClose: () => void }) {
  const open = Boolean(context);
  const module = context?.module;
  const create = useCreateExerciseReport();
  const setStatus = useSetModuleStatus();
  const { byModule } = useExerciseReports();
  const previous = module ? byModule.get(module.id) || [] : [];

  const [activityTitle, setActivityTitle] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [minutes, setMinutes] = useState<string>('');
  const [whatLearned, setWhatLearned] = useState('');
  const [struggles, setStruggles] = useState('');
  const [after, setAfter] = useState<AfterStatus>('keep');
  const [error, setError] = useState('');

  // Reset form whenever a new module is opened
  useEffect(() => {
    if (!module) return;
    setActivityTitle('');
    setConfidence(0);
    setDifficulty(0);
    setMinutes('');
    setWhatLearned('');
    setStruggles('');
    setError('');
    setAfter(module.status === 'done' ? 'keep' : module.status === 'exercise' ? 'done' : 'exercise');
  }, [module?.id, module?.status]);

  const busy = create.isPending || setStatus.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!module) return;
    setError('');
    if (!confidence || !difficulty) { setError('Please rate both confidence and difficulty.'); return; }
    const mins = minutes.trim() === '' ? null : Number(minutes);
    if (mins !== null && (!Number.isFinite(mins) || mins < 0 || mins > 1440)) { setError('Time spent must be between 0 and 1440 minutes.'); return; }

    try {
      await create.mutateAsync({ moduleId: module.id, activityTitle, confidence, difficulty, timeSpentMinutes: mins, whatLearned, struggles });
      let statusNote = '';
      if (after !== 'keep' && after !== module.status) {
        await setStatus.mutateAsync({ moduleId: module.id, status: after as ModuleStatus });
        statusNote = after === 'done' ? ` · module completed (+${module.xp_value} XP)` : ` · status → ${STATUS_META[after as ModuleStatus].label}`;
      }
      toast.success('Exercise report saved', { description: `+${EXERCISE_REPORT_XP} XP${statusNote}` });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save the report');
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" data-testid="exercise-report-drawer">
        {module && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Exercise self-report</span></div>
              <SheetTitle className="leading-snug">{module.title}</SheetTitle>
              <SheetDescription>
                {[context?.phaseLabel, context?.unitTitle].filter(Boolean).join(' · ')}
                {previous.length > 0 && <> · {previous.length} previous report{previous.length === 1 ? '' : 's'}</>}
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={submit} className="mt-6 space-y-6" data-testid="exercise-report-form">
              <div className="space-y-2">
                <Label htmlFor="activity-title">Activity / exercise name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="activity-title" data-testid="report-activity-title" placeholder="e.g. Lab: Pandas DataFrame basics" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} maxLength={200} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Confidence</Label>
                <Scale name="confidence" value={confidence} onChange={setConfidence} labels={CONFIDENCE_LABELS} tone="bg-primary text-primary-foreground border-primary" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mountain className="h-4 w-4 text-amber-600" /> Difficulty</Label>
                <Scale name="difficulty" value={difficulty} onChange={setDifficulty} labels={DIFFICULTY_LABELS} tone="bg-amber-500 text-white border-amber-500" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minutes" className="flex items-center gap-2"><Clock className="h-4 w-4 text-sky-600" /> Time spent (minutes)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input id="minutes" data-testid="report-minutes" type="number" min={0} max={1440} inputMode="numeric" placeholder="e.g. 45" className="w-28" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  {TIME_CHIPS.map((m) => (
                    <button key={m} type="button" data-testid={`report-minutes-${m}`} onClick={() => setMinutes(String(m))}
                      className={cn('rounded-full border px-2.5 py-1 text-xs', minutes === String(m) ? 'bg-sky-500 text-white border-sky-500' : 'text-muted-foreground hover:bg-muted')}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="learned">What did you learn?</Label>
                <Textarea id="learned" data-testid="report-learned" rows={3} placeholder="Key takeaways, formulas, patterns…" value={whatLearned} onChange={(e) => setWhatLearned(e.target.value)} maxLength={4000} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="struggles">Where did you struggle?</Label>
                <Textarea id="struggles" data-testid="report-struggles" rows={3} placeholder="Concepts to revisit, bugs, confusing steps…" value={struggles} onChange={(e) => setStruggles(e.target.value)} maxLength={4000} />
              </div>

              <div className="space-y-2">
                <Label>After saving, set module status</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['keep', `Keep (${STATUS_META[module.status].label})`],
                    ['exercise', 'Exercise'],
                    ['done', 'Done'],
                  ] as Array<[AfterStatus, string]>).map(([k, label]) => (
                    <button key={k} type="button" data-testid={`report-after-${k}`} onClick={() => setAfter(k)}
                      className={cn('h-9 rounded-md border text-xs font-medium truncate px-2 transition-colors',
                        after === k ? (k === 'done' ? 'bg-emerald-600 text-white border-emerald-600' : k === 'exercise' ? 'bg-amber-500 text-white border-amber-500' : 'bg-secondary border-transparent') : 'text-muted-foreground hover:bg-muted')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p role="alert" data-testid="report-error" className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">Earns <span className="font-semibold text-foreground">+{EXERCISE_REPORT_XP} XP</span>{after === 'done' && module.status !== 'done' ? ` (+${module.xp_value} for completing)` : ''}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
                  <Button type="submit" disabled={busy} data-testid="report-submit">
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save report
                  </Button>
                </div>
              </div>
            </form>

            {previous.length > 0 && (
              <div className="mt-8 space-y-3" data-testid="previous-reports">
                <h4 className="text-sm font-semibold">Previous reports</h4>
                {previous.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.activity_title || 'Exercise'}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.confidence && <Badge variant="outline">Confidence {r.confidence}/5</Badge>}
                      {r.difficulty && <Badge variant="outline">Difficulty {r.difficulty}/5</Badge>}
                      {r.time_spent_minutes != null && <Badge variant="outline">{r.time_spent_minutes} min</Badge>}
                    </div>
                    {r.what_learned && <p className="text-muted-foreground"><span className="text-foreground font-medium">Learned:</span> {r.what_learned}</p>}
                    {r.struggles && <p className="text-muted-foreground"><span className="text-foreground font-medium">Struggled:</span> {r.struggles}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
