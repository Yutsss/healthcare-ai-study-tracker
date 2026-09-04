import { describe, expect, it } from 'vitest';
import { questTemplatesToCreate, questsForWeek, type QuestType } from './quests';

const TIME_TYPES = new Set<QuestType>(['sessions', 'minutes', 'focus_intervals']);
const PROGRESS_TYPES = new Set<QuestType>(['modules', 'courses']);
const WILD_TYPES = new Set<QuestType>(['reports', 'streak']);

function mondayKeys(count: number): string[] {
  const cursor = new Date('2026-01-05T00:00:00.000Z');
  return Array.from({ length: count }, () => {
    const key = cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    return key;
  });
}

describe('weekly quest rotation', () => {
  it('provides broad variation across two years of weekly rotations', () => {
    const keys = new Set(mondayKeys(104).flatMap((week) => questsForWeek(week).map((quest) => quest.key)));
    expect(keys.size).toBeGreaterThanOrEqual(18);
  });

  it('always gives one time, one curriculum, and one reflection or streak quest', () => {
    for (const week of mondayKeys(104)) {
      const quests = questsForWeek(week);
      expect(quests).toHaveLength(3);
      expect(new Set(quests.map((quest) => quest.key)).size).toBe(3);
      expect(quests.filter((quest) => TIME_TYPES.has(quest.type))).toHaveLength(1);
      expect(quests.filter((quest) => PROGRESS_TYPES.has(quest.type))).toHaveLength(1);
      expect(quests.filter((quest) => WILD_TYPES.has(quest.type))).toHaveLength(1);
    }
  });

  it('keeps a given Monday deterministic', () => {
    expect(questsForWeek('2026-09-07')).toEqual(questsForWeek('2026-09-07'));
  });

  it('does not replace or extend quests once a week already has rows', () => {
    expect(questTemplatesToCreate('2026-09-07', 3)).toEqual([]);
    expect(questTemplatesToCreate('2026-09-07', 1)).toEqual([]);
    expect(questTemplatesToCreate('2026-09-07', 0)).toHaveLength(3);
  });
});
