'use client';

import { ProjectsScreen } from '@/components/lab/projects-screen';
import { useCreateProject, useDeleteProject, useMoveProject, useProjects, useUpdateProject } from '@/lib/hooks/useProjects';

export default function ProjectsPage() {
  const projects = useProjects();
  const create = useCreateProject();
  const update = useUpdateProject();
  const move = useMoveProject();
  const remove = useDeleteProject();
  return <ProjectsScreen mode="owner" projects={projects.projects} loading={projects.isLoading} error={Boolean(projects.error)} canPublish onCreate={async (input) => { await create.mutateAsync(input); }} onUpdate={async (id, input, existing) => { await update.mutateAsync({ id, input, existing }); }} onMove={async (_id, status, project) => { await move.mutateAsync({ project, status }); }} onDelete={async (id) => { await remove.mutateAsync(id); }} />;
}
