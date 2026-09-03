/**
 * The seed file does not link milestones to roadmap phases, so the mapping lives here.
 * Keys are seed ids (roadmap_items.key / milestones.key).
 */
export const MILESTONE_PHASE_MAP: Record<string, string[]> = {
  'milestone-01': ['roadmap-01', 'roadmap-02', 'roadmap-03', 'roadmap-04', 'roadmap-05'],
  'milestone-02': ['roadmap-06', 'roadmap-07'],
  'milestone-03': ['roadmap-08', 'roadmap-09', 'roadmap-10', 'roadmap-11'],
  'milestone-04': ['roadmap-12', 'roadmap-13', 'roadmap-14'],
};
