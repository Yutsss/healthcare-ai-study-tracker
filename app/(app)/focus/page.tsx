'use client';

import { FocusScreen } from '@/components/lab/focus-screen';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { useFocusSession } from '@/lib/hooks/useFocusSession';
import { useOwnerSettings, useStudyLogs, useUpdatePomodoroSettings } from '@/lib/hooks/useStudyLogs';
import { OWNER_ROUTES } from '@/lib/lab/routes';

export default function FocusPage() {
  const controller = useFocusSession();
  const settings = useOwnerSettings();
  const updateSettings = useUpdatePomodoroSettings();
  const curriculum = useCurriculumTree();
  const study = useStudyLogs();
  return <FocusScreen mode="owner" routes={OWNER_ROUTES} controller={controller} settings={settings.pomodoro} settingsLoading={settings.isLoading} tree={curriculum.tree} logs={study.logs} onSaveSettings={async (value) => { await updateSettings.mutateAsync(value); }} />;
}
