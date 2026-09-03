import React from 'react';
import { Award, BarChart3, BookOpenCheck, FolderKanban, Github, ImageIcon, Layers3, Play, Trophy } from 'lucide-react';
import { levelFromXp } from '@/lib/gamification';
import type { PublicShowcase } from '@/lib/showcase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type ShowcaseViewProps = {
  showcase: PublicShowcase;
};

function progressPercent(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function ProjectStatus({ status }: { status: PublicShowcase['projects'][number]['status'] }) {
  return <Badge variant="secondary">{status.replaceAll('_', ' ')}</Badge>;
}

function ProjectLinks({ project }: { project: PublicShowcase['projects'][number] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
      {project.githubUrl && (
        <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
          <Github className="h-4 w-4" /> GitHub
        </a>
      )}
      {project.demoUrl && (
        <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
          <Play className="h-4 w-4" /> Live demo
        </a>
      )}
      {project.coverImageUrl && (
        <a href={project.coverImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
          <ImageIcon className="h-4 w-4" /> View cover image
        </a>
      )}
    </div>
  );
}

export function ShowcaseView({ showcase }: ShowcaseViewProps) {
  const level = levelFromXp(showcase.stats.xp);
  const aggregateProgress = [
    { label: 'Phases', ...showcase.stats.phases, icon: Layers3 },
    { label: 'Courses', ...showcase.stats.courses, icon: BookOpenCheck },
    { label: 'Modules', ...showcase.stats.modules, icon: BarChart3 },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="showcase-title" className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div className="max-w-2xl space-y-2">
            <p className="text-sm font-semibold text-primary">Healthcare AI learning journey</p>
            <h1 id="showcase-title" className="text-3xl font-bold tracking-tight md:text-4xl">{showcase.profile.displayName}</h1>
            {showcase.profile.bio && <p className="text-muted-foreground">{showcase.profile.bio}</p>}
          </div>
          <div className="min-w-48 rounded-xl bg-primary p-4 text-primary-foreground shadow-md shadow-primary/20">
            <div className="flex items-center justify-between gap-4 text-sm font-semibold"><span>Level {level.level}</span><span>{level.xp} XP</span></div>
            <p className="mt-1 text-sm text-primary-foreground/80">{level.title}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25" aria-label={`${Math.round(level.progress * 100)}% to next level`}>
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-title">
        <div className="mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /><h2 id="progress-title" className="text-xl font-bold">Learning progress</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {aggregateProgress.map(({ label, completed, total, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{completed} / {total} {label.toLowerCase()}</p>
                <Progress value={progressPercent(completed, total)} className="mt-3 h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {showcase.phases.length > 0 && (
        <section aria-labelledby="phases-title">
          <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-primary" /><h2 id="phases-title" className="text-xl font-bold">Journey phases</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            {showcase.phases.map((phase) => (
              <Card key={phase.key}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{phase.title}</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Progress</span><span className="font-semibold tabular-nums">{phase.completed} / {phase.total}</span></div>
                  <Progress value={progressPercent(phase.completed, phase.total)} className="mt-3 h-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {showcase.achievements.length > 0 && (
        <section aria-labelledby="achievements-title">
          <div className="mb-4 flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><h2 id="achievements-title" className="text-xl font-bold">Achievements</h2></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {showcase.achievements.map((achievement) => (
              <Card key={achievement.key}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{achievement.title}</CardTitle></CardHeader>
                {achievement.description && <CardContent><CardDescription>{achievement.description}</CardDescription></CardContent>}
              </Card>
            ))}
          </div>
        </section>
      )}

      {showcase.projects.length > 0 && (
        <section aria-labelledby="projects-title">
          <div className="mb-4 flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /><h2 id="projects-title" className="text-xl font-bold">Public projects</h2></div>
          <div className="grid gap-5 md:grid-cols-2">
            {showcase.projects.map((project, index) => (
              <article key={`${project.title}-${project.startedAt ?? ''}-${index}`} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex aspect-[16/7] items-center justify-center bg-muted text-muted-foreground" aria-hidden="true"><ImageIcon className="h-10 w-10" /></div>
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{project.title}</h3>{project.projectType && <p className="mt-1 text-sm text-muted-foreground">{project.projectType}</p>}</div><ProjectStatus status={project.status} /></div>
                  {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
                  {project.tags.length > 0 && <div className="flex flex-wrap gap-2">{project.tags.map((tag, index) => <Badge key={`${tag}-${index}`} variant="outline">{tag}</Badge>)}</div>}
                  <ProjectLinks project={project} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
