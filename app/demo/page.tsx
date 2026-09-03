import { DemoApp, type DemoSeed } from '@/components/demo/demo-app';
import { PublicShell } from '@/components/public/public-shell';
import courseSeed from '@/data/yutas-lab-course-seed.json';

export default function DemoPage() {
  const seed: DemoSeed = {
    roadmap: courseSeed.roadmap.map((item) => ({
      id: item.id,
      title: item.title,
      phaseLabel: item.phase_label,
      order: item.order,
      provider: item.provider,
      category: item.category,
    })),
    courseUnits: courseSeed.course_units.map((unit) => ({
      id: unit.id,
      roadmapId: unit.roadmap_id,
      title: unit.title,
      order: unit.order,
    })),
    modules: courseSeed.modules.map((module) => ({
      id: module.id,
      roadmapId: module.roadmap_id,
      courseUnitId: module.course_unit_id,
      title: module.title,
      order: module.order,
    })),
    starterProjects: courseSeed.starter_projects.map((project) => ({
      id: project.id,
      title: project.title,
      type: project.type,
      skills: project.skills,
      github_url: project.github_url,
    })),
  };

  return <PublicShell mode="demo"><DemoApp seed={seed} /></PublicShell>;
}
