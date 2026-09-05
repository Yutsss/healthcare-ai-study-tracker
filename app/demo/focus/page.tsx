'use client';

import React from 'react';
import { useDemo } from '@/components/demo/demo-provider';
import { FocusScreen } from '@/components/lab/focus-screen';
import { useDemoFocusSession } from '@/lib/demo/focus-session';
import { DEMO_ROUTES } from '@/lib/lab/routes';

export default function DemoFocusPage() {
  const demo = useDemo();
  const controller = useDemoFocusSession();
  const logs = demo.state.logs.map((log) => ({ id: log.id, logged_on: log.loggedOn, minutes: log.minutes, topic: log.topic, notes: log.notes, module_id: log.moduleId, project_id: null, created_at: log.createdAt, source: log.source, session_id: log.sessionId, focus_intervals: log.focusIntervals }));
  const settings = { focusMinutes: demo.state.settings.focusMinutes, shortBreakMinutes: demo.state.settings.shortBreakMinutes, longBreakMinutes: demo.state.settings.longBreakMinutes, longBreakEvery: demo.state.settings.longBreakEvery };
  return <FocusScreen mode="demo" routes={DEMO_ROUTES} controller={controller} settings={settings} settingsLoading={!demo.hydrated} tree={demo.tree} logs={logs} onSaveSettings={async (value) => { demo.updateSettings({ ...demo.state.settings, ...value }); }} />;
}
