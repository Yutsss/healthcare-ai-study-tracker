'use client';

import { StudyLogScreen } from '@/components/lab/study-log-screen';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { useDeleteStudyLog, useOwnerSettings, useStudyLogs, useUpdateWeeklyGoal } from '@/lib/hooks/useStudyLogs';
import { OWNER_ROUTES } from '@/lib/lab/routes';

export default function StudyLogPage() {
  const study = useStudyLogs();
  const settings = useOwnerSettings();
  const curriculum = useCurriculumTree();
  const reports = useExerciseReports();
  const remove = useDeleteStudyLog();
  const updateGoal = useUpdateWeeklyGoal();
  return <StudyLogScreen mode="owner" routes={OWNER_ROUTES} tree={curriculum.tree} logs={study.logs} reports={reports.reports} loading={study.isLoading} weeklyGoal={settings.weeklyGoal} onDelete={async (id) => { await remove.mutateAsync(id); }} onSaveWeeklyGoal={async (minutes) => { await updateGoal.mutateAsync(minutes); }} />;
}
