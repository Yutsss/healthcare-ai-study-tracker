'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DemoSeed } from './demo-app';
import { useDemo } from './demo-provider';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function DemoLog({ modules }: { modules: DemoSeed['modules'] }) {
  const { state, addLog, deleteLog } = useDemo();
  const [loggedOn, setLoggedOn] = useState(today);
  const [minutes, setMinutes] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericMinutes = Number(minutes);
    if (!Number.isInteger(numericMinutes) || numericMinutes < 1 || numericMinutes > 1440) {
      setError('Minutes must be between 1 and 1440.');
      return;
    }
    setError(null);
    addLog({
      id: crypto.randomUUID(),
      loggedOn,
      minutes: numericMinutes,
      topic,
      notes,
      moduleId: moduleId || null,
      createdAt: new Date().toISOString(),
    });
    setMinutes('');
    setTopic('');
    setNotes('');
    setModuleId('');
  }

  return (
    <section aria-labelledby="demo-log-title" className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle id="demo-log-title">Add a study log</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-2"><Label htmlFor="demo-log-date">Date</Label><Input id="demo-log-date" type="date" value={loggedOn} onChange={(event) => setLoggedOn(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="demo-log-minutes">Minutes</Label><Input id="demo-log-minutes" type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="demo-log-topic">Topic</Label><Input id="demo-log-topic" maxLength={200} value={topic} onChange={(event) => setTopic(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="demo-log-notes">Notes</Label><Textarea id="demo-log-notes" maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="space-y-2">
              <Label htmlFor="demo-log-module">Module</Label>
              <select id="demo-log-module" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
                <option value="">No module selected</option>
                {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
              </select>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full">Add study log</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div><h2 className="text-xl font-bold">Recent study logs</h2><p className="mt-1 text-sm text-muted-foreground">Stored only in this browser.</p></div>
        {state.logs.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No study logs yet.</p> : [...state.logs].reverse().map((log) => {
          const label = log.topic || 'Study session';
          return (
            <Card key={log.id}>
              <CardHeader className="pb-3"><CardTitle className="text-base"><h3>{label}</h3></CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div><p className="font-semibold">{log.minutes} minutes</p><p className="text-sm text-muted-foreground">{log.loggedOn}</p>{log.notes && <p className="mt-2 text-sm">{log.notes}</p>}</div>
                <Button type="button" variant="outline" size="sm" aria-label={`Delete log ${label}`} onClick={() => deleteLog(log.id)}>Delete</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
