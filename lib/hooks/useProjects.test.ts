import { describe, expect, it } from 'vitest';
import { cleanProjectInput } from './useProjects';

const validProject = {
  title: 'Clinical risk model',
  description: 'A clinical decision support prototype.',
  project_type: 'Portfolio',
  status: 'idea' as const,
  tags: ['Python'],
  github_url: 'https://github.com/example/clinical-risk',
  demo_url: 'https://example.com/demo',
  cover_image_url: 'https://example.com/cover.png',
  is_public: false,
};

describe('cleanProjectInput', () => {
  it('keeps publication opt-in false unless explicitly true', () => {
    expect(cleanProjectInput({ ...validProject, is_public: false }).is_public).toBe(false);
    expect(cleanProjectInput({ ...validProject, is_public: true }).is_public).toBe(true);
  });

  it('normalizes project fields within their publication-safe bounds', () => {
    const cleaned = cleanProjectInput({
      ...validProject,
      title: `  ${'t'.repeat(201)}  `,
      description: `  ${'d'.repeat(4001)}  `,
      project_type: `  ${'p'.repeat(101)}  `,
      tags: [' Python ', 'Python', '', '  SQL  ', ...Array.from({ length: 25 }, (_, i) => `tag-${i}-${'x'.repeat(40)}`)],
      github_url: ' javascript:alert(1) ',
      demo_url: 'not-a-url',
      cover_image_url: ' https://example.com/cover.png ',
    });

    expect(cleaned.title).toHaveLength(200);
    expect(cleaned.description).toHaveLength(4000);
    expect(cleaned.project_type).toHaveLength(100);
    expect(cleaned.tags).toHaveLength(20);
    expect(cleaned.tags.slice(0, 2)).toEqual(['Python', 'SQL']);
    expect(cleaned.tags.every((tag) => tag.length <= 40)).toBe(true);
    expect(cleaned.tags).toContain(`tag-0-${'x'.repeat(34)}`);
    expect(cleaned.tags).toContain(`tag-10-${'x'.repeat(33)}`);
    expect(cleaned.github_url).toBeNull();
    expect(cleaned.demo_url).toBeNull();
    expect(cleaned.cover_image_url).toBe('https://example.com/cover.png');
  });

  it('rejects a title that is empty after trimming', () => {
    expect(() => cleanProjectInput({ ...validProject, title: '   ' })).toThrow('Title is required');
  });
});
