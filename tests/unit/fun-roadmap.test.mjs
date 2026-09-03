import assert from 'node:assert/strict';
import test from 'node:test';

import { achievementTone, phaseTone } from '../../lib/fun-roadmap.ts';

test('completed phases always use the success tone', () => {
  for (const index of [1, 2, 6.1, 13]) {
    assert.equal(phaseTone(index, 'completed').name, 'emerald');
  }
});

test('unfinished phase tones cycle predictably across the roadmap', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((index) => phaseTone(index, 'not_started').name),
    ['violet', 'sky', 'amber', 'rose', 'teal', 'violet'],
  );
});

test('earned achievements use success styling and locked achievements retain varied tones', () => {
  assert.equal(achievementTone(3, true).name, 'emerald');
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => achievementTone(index, false).name),
    ['violet', 'sky', 'amber', 'rose'],
  );
});
