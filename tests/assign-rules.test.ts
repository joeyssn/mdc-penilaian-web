import assert from 'node:assert/strict';
import { headCandidates, candidatesFor, evaluatorErrors, isTarget, modesFor } from '../src/lib/assign/rules.ts';

const t = (name: string, fn: () => void) => { fn(); console.log('ok', name); };

t('who gets which screen', () => {
  assert.deepEqual(modesFor({ role: 'DIRECTOR' }), ['PRINCIPAL_VP', 'HEAD_WORKERS']);
  assert.deepEqual(modesFor({ role: 'HRD' }), ['KARYAWAN']);
  assert.deepEqual(modesFor({ role: 'PRINCIPAL', level: 'SMP' }), ['SCHOOL_TEACHERS']);
  assert.deepEqual(modesFor({ role: 'VICE_PRINCIPAL_KURIKULUM', level: 'SMA' }), ['SCHOOL_TEACHERS']);
  assert.deepEqual(modesFor({ role: 'PRINCIPAL', level: 'SD' }), []); // SD uses the SD module
  assert.deepEqual(modesFor({ role: 'TEACHER', level: 'SMP' }), []);
});
t('principal evaluates vice principal of the same school only', () => {
  const vp = { id: 'v', role: 'VICE_PRINCIPAL_KESISWAAN', level: 'SMP' };
  assert.equal(evaluatorErrors('PRINCIPAL_VP', 'SUPERVISOR', vp, { id: 'p', role: 'PRINCIPAL', level: 'SMP' }).length, 0);
  assert.ok(evaluatorErrors('PRINCIPAL_VP', 'SUPERVISOR', vp, { id: 'p', role: 'PRINCIPAL', level: 'SMA' }).length);
  assert.ok(evaluatorErrors('PRINCIPAL_VP', 'SUPERVISOR', vp, { id: 'x', role: 'TEACHER', level: 'SMP' }).length);
});
t('vice principals get vice principal peers', () => {
  const vp = { id: 'v1', role: 'VICE_PRINCIPAL_KURIKULUM', level: 'SMP' };
  assert.equal(evaluatorErrors('PRINCIPAL_VP', 'PEER', vp, { id: 'v2', role: 'VICE_PRINCIPAL_KESISWAAN', level: 'SMP' }).length, 0);
  assert.equal(evaluatorErrors('PRINCIPAL_VP', 'PEER', vp, { id: 'v3', role: 'VICE_PRINCIPAL_KURIKULUM', level: 'SMA' }).length, 0);
  assert.ok(evaluatorErrors('PRINCIPAL_VP', 'PEER', vp, { id: 'p', role: 'PRINCIPAL', level: 'SMP' }).length);
  assert.ok(evaluatorErrors('PRINCIPAL_VP', 'PEER', vp, { id: 'v1', role: 'VICE_PRINCIPAL_KURIKULUM', level: 'SMP' }).length); // self
});
t('head evaluates workers of the same division', () => {
  const w = { id: 'w', role: 'STAFF', level: 'SMP', division: 'IT' };
  assert.ok(isTarget('HEAD_WORKERS', { role: 'DIRECTOR' }, w));
  assert.ok(!isTarget('HEAD_WORKERS', { role: 'DIRECTOR' }, { id: 'a', role: 'STAFF' })); // no division
  assert.equal(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, { id: 'h', role: 'HEAD_MANAGEMENT', division: 'IT' }).length, 0);
  assert.ok(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, { id: 'h', role: 'HEAD_MANAGEMENT', division: 'PR' }).length);
  // the head can also be one of the team itself (admin / staff of the same division)
  assert.equal(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, { id: 'h2', role: 'STAFF', division: 'IT' }).length, 0);
  assert.equal(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, { id: 'h3', role: 'ADMIN', division: 'IT' }).length, 0);
  assert.ok(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, { id: 'h4', role: 'TEACHER', division: 'IT' }).length);
});
t('director chooses the head; peers are the same team', () => {
  const w = { id: 'w', role: 'STAFF', division: 'IT' };
  const a = { id: 'a', role: 'STAFF', division: 'IT' }, b = { id: 'b', role: 'ADMIN', division: 'IT' };
  assert.deepEqual(headCandidates('IT', [a, b, { id: 'c', role: 'STAFF', division: 'PR' }, { id: 'd', role: 'TEACHER', division: 'IT' }]).map(x => x.id), ['a', 'b']);
  assert.equal(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, a, { IT: 'a' }).length, 0);
  assert.ok(evaluatorErrors('HEAD_WORKERS', 'SUPERVISOR', w, b, { IT: 'a' }).length); // only the chosen head
  assert.equal(evaluatorErrors('HEAD_WORKERS', 'PEER', w, b, { IT: 'a' }).length, 0);   // peers are not limited to the head
  assert.ok(evaluatorErrors('HEAD_WORKERS', 'PEER', w, { id: 'x', role: 'STAFF', division: 'PR' }).length);
});
t('school teachers: same school, right account types', () => {
  const viewer = { role: 'PRINCIPAL', level: 'SMP' };
  assert.ok(isTarget('SCHOOL_TEACHERS', viewer, { id: 'a', role: 'TEACHER', level: 'SMP' }));
  assert.ok(!isTarget('SCHOOL_TEACHERS', viewer, { id: 'a', role: 'TEACHER', level: 'SMA' }));
  const target = { id: 'a', role: 'TEACHER', level: 'SMP' };
  assert.equal(evaluatorErrors('SCHOOL_TEACHERS', 'PEER', target, { id: 'b', role: 'STAFF', level: 'SMP' }).length, 0);
  assert.ok(evaluatorErrors('SCHOOL_TEACHERS', 'SUPERVISOR', target, { id: 'b', role: 'STAFF', level: 'SMP' }).length);
  assert.ok(evaluatorErrors('SCHOOL_TEACHERS', 'PEER', target, { id: 'b', role: 'TEACHER', level: 'SMA' }).length);
  assert.ok(evaluatorErrors('SCHOOL_TEACHERS', 'PEER', target, { id: 'a', role: 'TEACHER', level: 'SMP' }).length); // self
});
t('HRD: karyawan evaluate karyawan, any school', () => {
  const k = { id: 'k1', role: 'KARYAWAN', level: 'SD' };
  assert.equal(evaluatorErrors('KARYAWAN', 'PEER', k, { id: 'k2', role: 'KARYAWAN', level: 'SMA' }).length, 0);
  assert.ok(evaluatorErrors('KARYAWAN', 'PEER', k, { id: 't', role: 'TEACHER' }).length);
  assert.ok(evaluatorErrors('KARYAWAN', 'SUPERVISOR', k, { id: 'k2', role: 'KARYAWAN' }).length);
  assert.equal(candidatesFor('KARYAWAN', 'PEER', k, [{ id: 'k1', role: 'KARYAWAN' }, { id: 'k2', role: 'KARYAWAN' }, { id: 't', role: 'TEACHER' }]).length, 1);
});
