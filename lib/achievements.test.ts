import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementProgress, type AchievementMetric, type AchievementStats } from './achievements';

const ZERO_STATS: AchievementStats = {
  modules_done: 0,
  units_done: 0,
  phases_done: 0,
  reports: 0,
  logs: 0,
  minutes: 0,
  streak: 0,
  level: 0,
};

describe('achievement catalogue', () => {
  it('offers at least three escalating challenges for every tracked habit', () => {
    const metrics: AchievementMetric[] = [
      'modules_done', 'units_done', 'phases_done', 'reports', 'logs', 'minutes', 'streak', 'level',
    ];

    for (const metric of metrics) {
      const targets = ACHIEVEMENTS.filter((achievement) => achievement.metric === metric).map((achievement) => achievement.target);
      expect(targets.length, metric).toBeGreaterThanOrEqual(3);
      expect(new Set(targets).size, `${metric} targets`).toBe(targets.length);
      expect(targets, `${metric} progression`).toEqual([...targets].sort((a, b) => a - b));
    }
  });

  it('unlocks the full-phase challenge only after all fourteen phases', () => {
    const challenge = ACHIEVEMENTS.find((achievement) => achievement.key === 'phases_all');
    expect(challenge).toMatchObject({
      title: 'Clinical AI Pathfinder',
      metric: 'phases_done',
      target: 14,
      xp_reward: 1000,
    });

    expect(achievementProgress(challenge!, { ...ZERO_STATS, phases_done: 13 }).complete).toBe(false);
    expect(achievementProgress(challenge!, { ...ZERO_STATS, phases_done: 14 }).complete).toBe(true);
  });

  it('keeps achievement keys unique and rewards positive', () => {
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.key)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((achievement) => achievement.xp_reward > 0 && achievement.target > 0)).toBe(true);
  });
});
