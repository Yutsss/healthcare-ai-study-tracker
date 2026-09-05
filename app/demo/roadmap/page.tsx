'use client';

import React from 'react';
import { useDemo } from '@/components/demo/demo-provider';
import { RoadmapScreen } from '@/components/lab/roadmap-screen';
import { DEMO_ROUTES } from '@/lib/lab/routes';

export default function DemoRoadmapPage() {
  const demo = useDemo();
  const reports = demo.state.reports.map((report) => ({ id: report.id, module_id: report.moduleId, activity_title: report.activityTitle, confidence: report.confidence, difficulty: report.difficulty, time_spent_minutes: report.timeSpentMinutes, what_learned: report.whatLearned, struggles: report.struggles, created_at: report.createdAt }));
  return (
    <RoadmapScreen
      mode="demo" routes={DEMO_ROUTES} tree={demo.tree} loading={!demo.hydrated} error={false} reports={reports} busy={false}
      onSetModuleStatus={async (moduleId, status) => { demo.setModuleStatus(moduleId, status); }}
      onCreateReport={async (input) => { demo.addReport({ ...input, activityTitle: input.activityTitle || null, whatLearned: input.whatLearned || null, struggles: input.struggles || null }); }}
    />
  );
}
