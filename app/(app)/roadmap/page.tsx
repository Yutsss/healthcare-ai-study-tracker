'use client';

import { RoadmapScreen } from '@/components/lab/roadmap-screen';
import { useCurriculumTree, useSetModuleStatus } from '@/lib/hooks/useCurriculum';
import { useCreateExerciseReport, useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { OWNER_ROUTES } from '@/lib/lab/routes';

export default function RoadmapPage() {
  const curriculum = useCurriculumTree();
  const status = useSetModuleStatus();
  const reports = useExerciseReports();
  const createReport = useCreateExerciseReport();
  return (
    <RoadmapScreen
      mode="owner" routes={OWNER_ROUTES} tree={curriculum.tree} loading={curriculum.isLoading}
      error={Boolean(curriculum.error)} reports={reports.reports} busy={status.isPending || createReport.isPending}
      onSetModuleStatus={async (moduleId, moduleStatus) => { await status.mutateAsync({ moduleId, status: moduleStatus }); }}
      onCreateReport={async (input) => { await createReport.mutateAsync(input); }}
    />
  );
}
