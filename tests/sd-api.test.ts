// End-to-end checks against a RUNNING dev server and the demo data (seed-sd.ts + seed-sd-groups.ts).
//   npx tsx tests/sd-api.test.ts            (server on http://localhost:3000)
// Covers tests D, E, F, H of the spec through real HTTP calls, so the backend rules are exercised, not the UI.
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function login(user: string) {
  const res = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user, password: 'sd12345' }) });
  assert.equal(res.status, 200, `login ${user}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  return async (path: string, method = 'GET', body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => ({})) as any };
  };
}
let n = 0; const ok = (m: string) => console.log('ok -', ++n, m);

async function answersFor(api: Awaited<ReturnType<typeof login>>, student: boolean) {
  const r = (await api('/api/rubric')).data as any[];
  const rubric = r.find(x => x.schoolLevel === 'SD' && !x.isSelfReflection && (x.evaluators || []).map((e: string) => e.trim().toLowerCase()).includes('student') === student);
  assert.ok(rubric, 'SD rubric available');
  const ids = rubric.sections.flatMap((s: any) => s.categories.flatMap((c: any) => c.indicators.map((i: any) => i.id)));
  return { rubricId: rubric.id, scores: ids.map((indicatorId: string) => ({ indicatorId, value: 3 })) };
}

(async () => {
  const kepsek = await login('sd.kepsek'), wakasis = await login('sd.wakasis'), pengawas = await login('sd.pengawas');
  const g1 = await login('sd.guru1'), g3 = await login('sd.guru3'), g5 = await login('sd.guru5');
  const s1 = await login('sd.siswa1'), s3 = await login('sd.siswa3');
  const users = (await kepsek('/api/sd/teachers')).data;
  const id = (name: string) => users.teachers.find((t: any) => t.name === name)?.id;
  const period = (await kepsek('/api/sd/periods')).data.find((p: any) => p.status === 'OPEN');
  const guru = (await g1('/api/me')).data.id, _unused = 0;

  // H: role guards
  assert.equal((await g1('/api/sd/groups', 'POST', { name: 'X', periodId: period.id, classOne: '1A', classTwo: '1B' })).status, 403); ok('H: a teacher cannot create groups');
  assert.equal((await s1('/api/sd/student-assignments', 'PUT', { periodId: period.id, studentIds: [], teacherIds: [] })).status, 403); ok('H: a student cannot assign teachers');
  assert.equal((await kepsek('/api/sd/groups', 'POST', { name: 'Bad', periodId: period.id, classOne: '9A', classTwo: '9a' })).status, 400); ok('1: a group with the same class twice is rejected');

  // A/B: peer — guru1 (Math 4A, EXACT) -> guru3 (BI 4A, NON-EXACT) must be refused; -> guru2 (IPA 4A partner) allowed
  const rub = await answersFor(g1, false);
  const guru3Id = (await g3('/api/me')).data.id;
  assert.equal((await g1('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: guru3Id, ...rub })).status, 403); ok('B: EXACT teacher cannot score a NON-EXACT teacher');
  assert.equal((await g1('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: guru, ...rub })).status, 403); ok('A: nobody scores themselves');
  const t1 = (await g1('/api/sd/my-tasks')).data;
  assert.ok(t1.peer.targets.every((t: any) => t.category === 'EXACT') && t1.peer.targets.length === 3); ok('A: guru1 sees exactly the 3 other EXACT teachers across 4A and 4B');
  const crossClass = t1.peer.targets.find((t: any) => t.className === '4B');
  assert.equal((await g1('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: crossClass.teacherId, ...rub })).status, 200); ok('A: cross-class peer evaluation accepted');
  assert.equal((await g1('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: crossClass.teacherId, ...rub })).status, 409); ok('duplicate peer submission rejected');

  // E: supervisor — only assigned teachers
  assert.equal((await pengawas('/api/sd/evaluations', 'POST', { type: 'SUPERVISOR', targetId: crossClass.teacherId, ...rub })).status, 403); ok('E: unassigned supervisor refused');
  assert.equal((await kepsek('/api/sd/supervisors', 'POST', { periodId: period.id, supervisorId: (await pengawas('/api/me')).data.id, teacherId: crossClass.teacherId })).status, 200);
  assert.equal((await pengawas('/api/sd/evaluations', 'POST', { type: 'SUPERVISOR', targetId: crossClass.teacherId, ...rub })).status, 200); ok('E: assigned supervisor can score, outside any group');

  // D: students — only what the VP assigned
  const student1 = (await s1('/api/me')).data.id;
  assert.equal((await s1('/api/sd/evaluations', 'POST', { type: 'STUDENT', targetId: guru, ...(await answersFor(s1, true)) })).status, 403); ok('D: unassigned teacher refused for a student');
  assert.equal((await wakasis('/api/sd/student-assignments', 'PUT', { periodId: period.id, studentIds: [student1], teacherIds: [guru], mode: 'replace' })).status, 200);
  assert.deepEqual((await s1('/api/sd/my-tasks')).data.student.pending.map((p: any) => p.teacherId), [guru]); ok('D: student sees only the assigned teacher');
  assert.equal((await wakasis('/api/sd/student-assignments', 'PUT', { periodId: period.id, studentIds: [student1], teacherIds: [crossClass.teacherId], mode: 'add' })).status, 400); ok('D: teacher of another class cannot be assigned');
  assert.equal((await s1('/api/sd/evaluations', 'POST', { type: 'STUDENT', targetId: guru, ...(await answersFor(s1, true)) })).status, 200);

  // F: three separate sources
  const rows = (await kepsek('/api/sd/evaluations')).data;
  const row = rows.find((r: any) => r.teacherId === crossClass.teacherId);
  assert.equal(row.peer.submitted, 1); assert.equal(row.supervisor.submitted, 1); assert.equal(row.student.submitted, 0); ok('F: peer and supervisor stored as separate sources');
  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
