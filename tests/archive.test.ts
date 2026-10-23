// Run: node --experimental-strip-types tests/archive.test.ts
import assert from 'node:assert/strict';
import { buildLabels, editArchivedScore, editArchivedSdAnswer } from '../src/lib/archive.ts';

const scores = [{ id: 's1', value: 'A' }, { id: 's2', value: 'D' }];
const e1 = editArchivedScore(scores, 's2', 3);
assert.equal(e1.next[1].value, 'B'); assert.equal(e1.before, 'D'); assert.equal(scores[1].value, 'D', 'input is not mutated');
assert.throws(() => editArchivedScore(scores, 'nope', 3)); assert.throws(() => editArchivedScore(scores, 's1', 5)); assert.throws(() => editArchivedScore(scores, 's1', 2.5));
console.log('ok - archived rubric score edit');

const sd = [{ id: 'e1', answers: [{ indicatorId: 'i1', value: 4 }, { indicatorId: 'i2', value: 2 }], average: 3 }];
const e2 = editArchivedSdAnswer(sd, 'e1', 'i2', 4);
assert.equal(e2.next[0].average, 4); assert.equal(e2.before, 2); assert.equal(sd[0].average, 3);
assert.throws(() => editArchivedSdAnswer(sd, 'e1', 'zzz', 3)); assert.throws(() => editArchivedSdAnswer(sd, 'e1', 'i1', 0));
console.log('ok - archived SD answer edit recomputes the average');

const l = buildLabels({ userIds: ['u1', 'ghost'], indicatorIds: ['i1'], rubricIds: [] }, [{ id: 'u1', name: 'Ani' }, { id: 'u2', name: 'Budi' }], [{ id: 'i1', text: 'Q1' }, { id: 'i2', text: 'Q2' }], []);
assert.deepEqual(l, { users: { u1: 'Ani' }, indicators: { i1: 'Q1' }, rubrics: {} });
console.log('ok - labels keep only what the record references');
