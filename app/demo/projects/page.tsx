'use client';

import React from 'react';
import { useDemo } from '@/components/demo/demo-provider';
import { ProjectsScreen } from '@/components/lab/projects-screen';

export default function DemoProjectsPage() {
  const demo = useDemo();
  const projects = demo.state.projects.map((project, index) => ({ id: project.id, key: null, title: project.title, description: project.description, project_type: project.projectType, status: project.status, tags: project.tags, github_url: project.githubUrl, demo_url: project.demoUrl, cover_image_url: project.coverImageUrl, is_public: false, started_at: project.startedAt, completed_at: project.completedAt, sort_order: index + 1, created_at: project.createdAt, updated_at: project.updatedAt }));
  return <ProjectsScreen
    mode="demo" projects={projects} loading={!demo.hydrated} error={false} canPublish={false}
    onCreate={async (input) => { demo.saveProject({ id: crypto.randomUUID(), title: input.title, description: input.description || null, projectType: input.project_type || null, status: input.status, tags: input.tags, githubUrl: input.github_url || null, demoUrl: input.demo_url || null, coverImageUrl: input.cover_image_url || null, createdAt: null, updatedAt: null, startedAt: null, completedAt: null }); }}
    onUpdate={async (id, input) => { const existing = demo.state.projects.find((project) => project.id === id); if (!existing) return; demo.saveProject({ ...existing, title: input.title, description: input.description || null, projectType: input.project_type || null, status: input.status, tags: input.tags, githubUrl: input.github_url || null, demoUrl: input.demo_url || null, coverImageUrl: input.cover_image_url || null }); }}
    onMove={async (id, status) => { demo.setProjectStatus(id, status); }}
    onDelete={async (id) => { demo.deleteProject(id); }}
  />;
}
