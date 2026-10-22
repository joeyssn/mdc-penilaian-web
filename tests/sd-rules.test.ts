// Run: node --experimental-strip-types tests/sd-rules.test.ts
import assert from 'node:assert/strict';
import { canPeerEvaluate, peerTargets, validateClasses, validateGroupForPublish, validatePartnership, teachersForClass, type MemberLite, type Subject } from '../src/lib/sd/rules.ts';

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

// Group A = 1A + 1B, one teacher per subject per class (8 teachers). Group B = 2A + 2B (other teachers).
const mk = (id: string, groupId: string, teacher: string, cls: string, subject: Subject, partnerId: string | null): MemberLite =>
  ({ id, groupId, teacherId: teacher, className: cls, subject, partnerId });
const A: MemberLite[] = [
  mk('m1', 'A', 'tMath1A', '1A', 'MATEMATIKA', 'm2'), mk('m2', 'A', 'tSci1A', '1A', 'IPA', 'm1'),
  mk('m3', 'A', 'tBI1A', '1A', 'BAHASA_INDONESIA', 'm4'), mk('m4', 'A', 'tPPKN1A', '1A', 'PPKN', 'm3'),
  mk('m5', 'A', 'tMath1B', '1B', 'MATEMATIKA', 'm6'), mk('m6', 'A', 'tSci1B', '1B', 'IPA', 'm5'),
  mk('m7', 'A', 'tBI1B', '1B', 'BAHASA_INDONESIA', 'm8'), mk('m8', 'A', 'tPPKN1B', '1B', 'PPKN', 'm7'),
];
const group = { id: 'A', classOne: '1A', classTwo: '1B', status: 'PUBLISHED' };

test('A: EXACT teacher can score partner and EXACT teachers in both classes', () => {
  const ids = peerTargets('tMath1A', A).map(t => t.teacherId).sort();
  assert.deepEqual(ids, ['tMath1B', 'tSci1A', 'tSci1B']);
  assert.equal(peerTargets('tMath1A', A).find(t => t.teacherId === 'tSci1A')!.isPartner, true);
  assert.equal(peerTargets('tMath1A', A).find(t => t.teacherId === 'tSci1B')!.isPartner, false);
});
test('A: a teacher of another group gets nothing from this group', () => {
  assert.deepEqual(peerTargets('tOutsider', A), []);
  assert.equal(canPeerEvaluate('tOutsider', 'tMath1A', A).ok, false);
  assert.equal(canPeerEvaluate('tMath1A', 'tOutsider', A).ok, false);
});
test('B: category is enforced both ways', () => {
  assert.equal(canPeerEvaluate('tMath1A', 'tBI1A', A).ok, false);
  assert.equal(canPeerEvaluate('tMath1A', 'tPPKN1B', A).ok, false);
  assert.equal(canPeerEvaluate('tBI1A', 'tSci1A', A).ok, false);
  assert.equal(canPeerEvaluate('tPPKN1B', 'tMath1B', A).ok, false);
  assert.equal(canPeerEvaluate('tBI1A', 'tBI1B', A).ok, true);
});
test('never yourself / never twice', () => {
  assert.equal(canPeerEvaluate('tMath1A', 'tMath1A', A).ok, false);
  assert.equal(canPeerEvaluate('tMath1A', 'tSci1A', A, new Set(['tSci1A'])).ok, false);
  assert.ok(!peerTargets('tMath1A', A, new Set(['tSci1A'])).some(t => t.teacherId === 'tSci1A'));
});
test('C: partnership validation', () => {
  const by = (id: string) => A.find(m => m.id === id)!;
  assert.equal(validatePartnership(by('m1'), by('m2')).length, 0);
  assert.ok(validatePartnership(by('m1'), by('m6')).length > 0, 'different class rejected');
  assert.ok(validatePartnership(by('m1'), by('m3')).length > 0, 'Math with BI rejected');
  assert.ok(validatePartnership(by('m1'), mk('x', 'B', 'tSciX', '1A', 'IPA', null)).length > 0, 'different group rejected');
  assert.ok(validatePartnership(by('m1'), by('m1')).length > 0, 'self rejected');
  assert.ok(validatePartnership(by('m1'), by('m5')).length > 0, 'Math with Math rejected');
});
test('C: a valid group publishes; broken ones are reported', () => {
  assert.deepEqual(validateGroupForPublish(group, A), []);
  assert.ok(validateGroupForPublish(group, A.map(m => m.id === 'm2' ? { ...m, partnerId: null } : m)).length > 0, 'one-sided partnership');
  assert.ok(validateGroupForPublish(group, [mk('z', 'A', 't', '3C', 'PPKN', null)]).length > 0, 'class outside the group');
  assert.ok(validateGroupForPublish(group, []).length > 0, 'empty group');
  assert.ok(validateGroupForPublish(group, A.filter(m => m.id !== 'm2')).length > 0, 'partner removed');
});
test('1: a group needs two different classes', () => {
  assert.equal(validateClasses('1A', '1B').length, 0);
  assert.ok(validateClasses('1A', '1a').length > 0);
  assert.ok(validateClasses('1A', '').length > 0);
});
test('D: student can only be given teachers who teach the student class', () => {
  const t = teachersForClass('1a', A).map(m => m.teacherId).sort();
  assert.deepEqual(t, ['tBI1A', 'tMath1A', 'tPPKN1A', 'tSci1A']);
  assert.deepEqual(teachersForClass('9Z', A), []);
  assert.deepEqual(teachersForClass(null, A), []);
});
test('G: reassigning a partner changes future eligibility only', () => {
  // Math1A moves to be partnered with the Science teacher of 1B is invalid; moving a teacher out of the group removes all eligibility
  const without = A.filter(m => m.teacherId !== 'tSci1A').map(m => (m.partnerId === 'm2' ? { ...m, partnerId: null } : m));
  assert.ok(!peerTargets('tMath1A', without).some(t => t.teacherId === 'tSci1A'));
  assert.equal(peerTargets('tMath1A', without).length, 2);
});
test('multi-group: a teacher in two groups is eligible per group, and categories are judged per membership', () => {
  const B: MemberLite[] = [
    mk('b1', 'B', 'tMath1A', '2A', 'MATEMATIKA', 'b2'), mk('b2', 'B', 'tSci2A', '2A', 'IPA', 'b1'),
    mk('b3', 'B', 'tBI2B', '2B', 'BAHASA_INDONESIA', 'b4'), mk('b4', 'B', 'tPPKN2B', '2B', 'PPKN', 'b3'),
  ];
  // tMath1A teaches in both groups; groups are evaluated separately
  assert.deepEqual(peerTargets('tMath1A', B).map(t => t.teacherId), ['tSci2A']);
  assert.equal(canPeerEvaluate('tMath1A', 'tSci2A', A).ok, false, 'tSci2A is not in group A');
  assert.equal(canPeerEvaluate('tMath1A', 'tSci2A', B).ok, true);
  assert.equal(canPeerEvaluate('tMath1A', 'tBI2B', B).ok, false, 'category still enforced in group B');
});
console.log(`\n${n} tests passed`);
