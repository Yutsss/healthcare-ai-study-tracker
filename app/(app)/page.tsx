'use client';

import { DashboardScreen } from '@/components/lab/dashboard-screen';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useCurriculumTree, useSetModuleStatus } from '@/lib/hooks/useCurriculum';
import { useCreateExerciseReport, useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { useActivity, useStreak, useXp } from '@/lib/hooks/useGamification';
import { useMilestones } from '@/lib/hooks/useMilestones';
import { useOwnerSettings, useStudyLogs } from '@/lib/hooks/useStudyLogs';
import { useWeeklyQuests } from '@/lib/hooks/useWeeklyQuests';
import { OWNER_ROUTES } from '@/lib/lab/routes';

export default function DashboardPage() {
  const curriculum = useCurriculumTree();
  const xp = useXp();
  const streak = useStreak();
  const activity = useActivity(10);
  const status = useSetModuleStatus();
  const reports = useExerciseReports();
  const createReport = useCreateExerciseReport();
  const study = useStudyLogs();
  const settings = useOwnerSettings();
  const achievements = useAchievements();
  const milestones = useMilestones(curriculum.tree);
  const quests = useWeeklyQuests();

  return (
    <DashboardScreen
      mode="owner"
      name={settings.settings?.display_name?.trim() || 'Yuta'}
      routes={OWNER_ROUTES}
      tree={curriculum.tree}
      loading={curriculum.isLoading}
      error={Boolean(curriculum.error)}
      progression={{ xpEvents: xp.events, totalXp: xp.total, level: xp.level, streak: streak.streak, achievements: achievements.items, quests: quests.quests, milestones: milestones.items, activity: activity.data || [] }}
      progressionLoading={Boolean(xp.isLoading || streak.isLoading || activity.isLoading || achievements.isLoading || milestones.isLoading || quests.isLoading)}
      logs={study.logs}
      reports={reports.reports}
      weeklyGoal={settings.weeklyGoal}
      onSetModuleStatus={async (moduleId, moduleStatus) => { await status.mutateAsync({ moduleId, status: moduleStatus }); }}
      onCreateReport={async (input) => { await createReport.mutateAsync(input); }}
    />
  );
}
