'use client';

import { useDemo } from '@/components/demo/demo-provider';
import { ProgressScreen } from '@/components/lab/progress-screen';

export default function DemoProgressPage() {
  const demo = useDemo();
  const reports = demo.state.reports.map((report) => ({ id: report.id, module_id: report.moduleId, activity_title: report.activityTitle, confidence: report.confidence, difficulty: report.difficulty, time_spent_minutes: report.timeSpentMinutes, what_learned: report.whatLearned, struggles: report.struggles, created_at: report.createdAt }));
  return <ProgressScreen mode="demo" tree={demo.tree} reports={reports} xp={{ total: demo.progression.totalXp, level: demo.progression.level, events: demo.progression.xpEvents }} achievements={demo.progression.achievements} milestones={demo.progression.milestones} quests={demo.progression.quests} loading={!demo.hydrated} />;
}
