'use client';

import React from 'react';
import { useDemo } from '@/components/demo/demo-provider';
import { StudyLogScreen } from '@/components/lab/study-log-screen';
import { DEMO_ROUTES } from '@/lib/lab/routes';

export default function DemoStudyLogPage() {
  const demo = useDemo();
  const logs = demo.state.logs.map((log) => ({ id: log.id, logged_on: log.loggedOn, minutes: log.minutes, topic: log.topic, notes: log.notes, module_id: log.moduleId, project_id: null, created_at: log.createdAt, source: log.source, session_id: log.sessionId, focus_intervals: log.focusIntervals }));
  const reports = demo.state.reports.map((report) => ({ id: report.id, module_id: report.moduleId, activity_title: report.activityTitle, confidence: report.confidence, difficulty: report.difficulty, time_spent_minutes: report.timeSpentMinutes, what_learned: report.whatLearned, struggles: report.struggles, created_at: report.createdAt }));
  return <StudyLogScreen mode="demo" routes={DEMO_ROUTES} tree={demo.tree} logs={logs} reports={reports} loading={!demo.hydrated} weeklyGoal={demo.state.settings.weeklyGoalMinutes} onDelete={async (id) => { demo.deleteLog(id); }} onSaveWeeklyGoal={async (minutes) => { demo.updateSettings({ ...demo.state.settings, weeklyGoalMinutes: minutes }); }} />;
}
