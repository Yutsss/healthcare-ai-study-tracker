import type { AchievementProgress } from '@/lib/achievements';
import type { PhaseNode } from '@/lib/curriculum';
import type { LevelInfo } from '@/lib/gamification';
import type { QuestTemplate, QuestType } from '@/lib/quests';

export type LabStudyLog = {
  id: string;
  logged_on: string;
  minutes: number;
  topic: string | null;
  notes: string | null;
  module_id: string | null;
  project_id: string | null;
  created_at: string;
  source?: 'manual' | 'focus' | string;
  session_id?: string | null;
  focus_intervals?: number;
};

export type LabExerciseReport = {
  id: string;
  module_id: string;
  activity_title: string | null;
  confidence: number | null;
  difficulty: number | null;
  time_spent_minutes: number | null;
  what_learned: string | null;
  struggles: string | null;
  created_at: string;
};

export type NewLabExerciseReport = {
  moduleId: string;
  activityTitle: string;
  confidence: number;
  difficulty: number;
  timeSpentMinutes: number | null;
  whatLearned: string;
  struggles: string;
};

export type LabXpEvent = {
  id: string;
  amount: number;
  source_type: string;
  source_id: string | null;
  reason: string | null;
  created_at: string;
};

export type LabActivityEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, any>;
  created_at: string;
};

export type LabAchievementView = AchievementProgress & {
  id: string | null;
  earnedAt: string | null;
};

export type LabQuestRow = {
  id: string;
  week_start: string;
  key: string;
  title: string;
  description: string | null;
  quest_type: QuestType;
  target: number;
  progress: number;
  xp_reward: number;
  completed_at: string | null;
};

export type LabQuestView = LabQuestRow & {
  current: number;
  ratio: number;
  complete: boolean;
  template: QuestTemplate | undefined;
};

export type LabMilestoneView = {
  id: string;
  key: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  achieved_at: string | null;
  phases: PhaseNode[];
  phasesDone: number;
  percent: number;
  complete: boolean;
  index: number;
};

export type LabProgressionView = {
  xpEvents: LabXpEvent[];
  totalXp: number;
  level: LevelInfo;
  streak: { current: number; activeToday: boolean; longest: number };
  achievements: LabAchievementView[];
  quests: LabQuestView[];
  milestones: LabMilestoneView[];
  activity: LabActivityEvent[];
};
