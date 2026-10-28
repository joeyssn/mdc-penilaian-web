// Run: node --experimental-strip-types tests/sd-rules.test.ts
import assert from 'node:assert/strict';
import { eligibleRubrics, isRubricAllowed } from '../src/lib/sd/rubricRules.ts';
import { canSubmit, diffAssignments, leaderScore, validateAssignment } from '../src/lib/sd/rules.ts';

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

test('nobody evaluates themselves, in any role', () => {
  for (const r of ['SUPERVISOR', 'PEER', 'KOORDINATOR'] as const)
    assert.ok(validateAssignment('t1', { id: 't1', role: 'TEACHER' }, r).length > 0);
});
test('everyone picked must be a teacher account, for every role', () => {
  for (const r of ['SUPERVISOR', 'PEER', 'KOORDINATOR'] as const) {
    assert.equal(validateAssignment('t1', { id: 't2', role: 'TEACHER' }, r).length, 0);
    assert.ok(validateAssignment('t1', { id: 's1', role: 'STAFF' }, r).length > 0, 'staff is not allowed');
    assert.ok(validateAssignment('t1', { id: 'v1', role: 'VICE_PRINCIPAL_KURIKULUM' }, r).length > 0);
    assert.ok(validateAssignment('t1', { id: 'st', role: 'STUDENT' }, r).length > 0);
  }
  assert.ok(validateAssignment('t1', { id: 'x', role: 'TEACHER' }, 'BOSS' as any).length > 0);
});
test('submitting needs an active assignment of exactly that type', () => {
  assert.equal(canSubmit('PEER', { active: true, role: 'PEER' }), true);
  assert.equal(canSubmit('SUPERVISOR', { active: true, role: 'PEER' }), false, 'a peer assignment is not a supervisor assignment');
  assert.equal(canSubmit('PEER', { active: false, role: 'PEER' }), false);
  assert.equal(canSubmit('PEER', null), false);
});
test('changing the list keeps history: submitted evaluators are deactivated, never deleted', () => {
  const d = diffAssignments([
    { evaluatorId: 'a', active: true, hasEvaluations: true },
    { evaluatorId: 'b', active: true, hasEvaluations: false },
    { evaluatorId: 'c', active: false, hasEvaluations: false },
  ], ['c', 'd']);
  assert.deepEqual(d.toCreate, ['d']);
  assert.deepEqual(d.toReactivate, ['c']);
  assert.deepEqual(d.toDelete, ['b']);
  assert.deepEqual(d.toDeactivate, ['a']);
});
test('Leaders = average of the leader inputs that exist', () => {
  assert.equal(leaderScore(4, 2), 3);
  assert.equal(leaderScore(4, NaN), 4);
  assert.equal(leaderScore(NaN, 3), 3);
  assert.ok(Number.isNaN(leaderScore(NaN, NaN)));
});
test('rubrics: dedicated Supervisor / Koordinator rubrics are used when they exist, the generic one otherwise', () => {
  const generic = { id: 'g', evaluators: 'Teacher,Vice-Principal,Director/Principal' };
  const student = { id: 's', evaluators: 'Student' };
  const sup = { id: 'sup', evaluators: 'Supervisor' };
  const koor = { id: 'koor', evaluators: ['Koordinator'] };
  assert.deepEqual(eligibleRubrics('SUPERVISOR', [generic, student]).map(r => r.id), ['g'], 'fallback to generic');
  assert.deepEqual(eligibleRubrics('SUPERVISOR', [generic, student, sup, koor]).map(r => r.id), ['sup']);
  assert.deepEqual(eligibleRubrics('KOORDINATOR', [generic, sup, koor]).map(r => r.id), ['koor']);
  assert.deepEqual(eligibleRubrics('PEER', [generic, sup, koor]).map(r => r.id), ['g'], 'peers never use another role\'s rubric');
  assert.deepEqual(eligibleRubrics('STUDENT', [generic, student, sup]).map(r => r.id), ['s']);
  assert.equal(isRubricAllowed('SUPERVISOR', 'g', [generic, sup]), false, 'generic rubric refused once a supervisor rubric exists');
  assert.equal(isRubricAllowed('KOORDINATOR', 'sup', [generic, sup, koor]), false);
  assert.equal(isRubricAllowed('STUDENT', 'g', [generic, student]), false);
});
console.log(`\n${n} tests passed`);
