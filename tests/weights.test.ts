// Run: node --experimental-strip-types tests/weights.test.ts
import assert from 'node:assert/strict';
import { cardWeights, computeFinal, SD_DEFAULT_WEIGHTS, SMP_DEFAULT_WEIGHTS, validateSdWeights } from '../src/lib/weights.ts';

const t = (name: string, fn: () => void) => { fn(); console.log('ok', name); };
const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

t('defaults are valid', () => {
  assert.equal(validateSdWeights(SD_DEFAULT_WEIGHTS), null);
  assert.equal(validateSdWeights(SMP_DEFAULT_WEIGHTS), null);
  assert.ok(validateSdWeights({ ...SMP_DEFAULT_WEIGHTS, observationWeight: 20 }));
});

t('SMP / SMA use the main layout with observation', () => {
  const w = SMP_DEFAULT_WEIGHTS;
  // main = 10% x3 + 10% x3 + 20% x3 + 60% x3 = 3 ; student 4 ; hrd 2 ; observation 1
  const r = computeFinal('TEACHER', { ...w }, { student: 4, peer: 3, self: 3, supervisor: 3, leader: 3, observation: 1, attendance: 2 });
  near(r.main, 3);
  near(r.final, (3 * 69 + 4 * 11 + 2 * 10 + 1 * 10) / 100);
  assert.equal(r.incomplete, false);
});

t('observation is required when it has a weight, and ignored when it has none', () => {
  const r = computeFinal('TEACHER', { ...SMP_DEFAULT_WEIGHTS }, { student: 4, peer: 3, self: 3, supervisor: 3, leader: 3, observation: NaN, attendance: 2 });
  assert.equal(r.incomplete, true); assert.deepEqual(r.missing, ['Observation']);
  const sd = computeFinal('SD_TEACHER', { ...SD_DEFAULT_WEIGHTS }, { student: 4, peer: 3, self: 3, supervisor: 3, leader: 3, observation: NaN, attendance: 2 });
  assert.equal(sd.incomplete, false);
});

t('old profiles without a main weight still work as before', () => {
  const r = computeFinal('TEACHER', { studentWeight: 50, peerWeight: 50, selfWeight: 0, observationWeight: 0, attendanceWeight: 0 }, { student: 4, peer: 2, self: NaN, observation: NaN, attendance: NaN });
  near(r.final, 3);
});

t('dashboard cards: peers get main x peer share', () => {
  const c = cardWeights({ ...SMP_DEFAULT_WEIGHTS });
  near(c.peerWeight!, 6.9);
  assert.equal(c.observationWeight, 10);
  const old = { studentWeight: 25, peerWeight: 25 };
  assert.equal(cardWeights(old), old);
});
