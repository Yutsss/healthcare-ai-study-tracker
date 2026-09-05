'use client';

import { ProgressScreen } from '@/components/lab/progress-screen';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { useXp } from '@/lib/hooks/useGamification';
import { useMilestones } from '@/lib/hooks/useMilestones';
import { useWeeklyQuests } from '@/lib/hooks/useWeeklyQuests';

export default function ProgressPage() {
  const curriculum = useCurriculumTree();
  const reports = useExerciseReports();
  const xp = useXp();
  const achievements = useAchievements();
  const milestones = useMilestones(curriculum.tree);
  const quests = useWeeklyQuests();
  return <ProgressScreen mode="owner" tree={curriculum.tree} reports={reports.reports} xp={{ total: xp.total, level: xp.level, events: xp.events }} achievements={achievements.items} milestones={milestones.items} quests={quests.quests} loading={Boolean(curriculum.isLoading || reports.isLoading || xp.isLoading || achievements.isLoading || milestones.isLoading || quests.isLoading)} />;
}
