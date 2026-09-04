'use client';

import React from 'react';
import { DashboardScreen } from '@/components/lab/dashboard-screen';
import { useDemo } from '@/components/demo/demo-provider';
import { DEMO_ROUTES } from '@/lib/lab/routes';

export default function DemoPage() {
  const demo = useDemo();
  const logs = demo.state.logs.map((log) => ({ id: log.id, logged_on: log.loggedOn, minutes: log.minutes, topic: log.topic, notes: log.notes, module_id: log.moduleId, project_id: null, created_at: log.createdAt, source: log.source, session_id: log.sessionId, focus_intervals: log.focusIntervals }));
  const reports = demo.state.reports.map((report) => ({ id: report.id, module_id: report.moduleId, activity_title: report.activityTitle, confidence: report.confidence, difficulty: report.difficulty, time_spent_minutes: report.timeSpentMinutes, what_learned: report.whatLearned, struggles: report.struggles, created_at: report.createdAt }));
  return (
    <DashboardScreen
      mode="demo" name="Guest" routes={DEMO_ROUTES} tree={demo.tree} loading={!demo.hydrated} error={false}
      progression={demo.progression} progressionLoading={!demo.hydrated} logs={logs} reports={reports}
      weeklyGoal={demo.state.settings.weeklyGoalMinutes}
      onSetModuleStatus={async (moduleId, status) => { demo.setModuleStatus(moduleId, status); }}
      onCreateReport={async (input) => { demo.addReport({ ...input, activityTitle: input.activityTitle || null, whatLearned: input.whatLearned || null, struggles: input.struggles || null }); }}
    />
  );
}
