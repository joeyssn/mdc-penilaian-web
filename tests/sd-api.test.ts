// End-to-end checks against a RUNNING dev server and the demo data (seed-sd.ts + seed-sd-assignments.ts).
//   npx tsx tests/sd-api.test.ts            (server on http://localhost:3000)
// Exercises the backend rules through real HTTP calls (not the UI). Needs a fresh demo period (re-run the seed after an archive reset).
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function login(user: string) {
  const res = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user, password: 'sd12345' }) });
  assert.equal(res.status, 200, `login ${user}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  return async (path: string, method = 'GET', body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
  };
}
type Api = Awaited<ReturnType<typeof login>>;
let n = 0; const ok = (m: string) => console.log('ok -', ++n, m);

async function answers(api: Api, student: boolean) {
  const r = (await api('/api/rubric')).data as any[];
  const rubric = r.find(x => x.schoolLevel === 'SD' && !x.isSelfReflection && (x.evaluators || []).map((e: string) => e.trim().toLowerCase()).includes('student') === student);
  assert.ok(rubric, 'SD rubric available');
  const ids = rubric.sections.flatMap((s: any) => s.categories.flatMap((c: any) => c.indicators.map((i: any) => i.id)));
  return { rubricId: rubric.id, scores: ids.map((indicatorId: string) => ({ indicatorId, value: 3 })) };
}

(async () => {
  const kepsek = await login('sd.kepsek'), wakasis = await login('sd.wakasis'), staff = await login('sd.pengawas');
  const g1 = await login('sd.guru1'), g2 = await login('sd.guru2'), g3 = await login('sd.guru3'), s1 = await login('sd.siswa1');
  const period = (await kepsek('/api/sd/periods')).data.find((p: any) => p.status === 'OPEN');
  const id1 = (await g1('/api/me')).data.id, id2 = (await g2('/api/me')).data.id, id3 = (await g3('/api/me')).data.id;
  const rub = await answers(g1, false);

  // Authorization
  assert.equal((await g1('/api/sd/assignments', 'PUT', { periodId: period.id, teacherId: id2, role: 'PEER', evaluatorIds: [id1] })).status, 403); ok('a teacher cannot assign evaluators');
  assert.equal((await s1('/api/sd/student-assignments', 'PUT', { periodId: period.id, studentIds: [], teacherIds: [] })).status, 403); ok('a student cannot assign teachers');
  assert.equal((await kepsek('/api/sd/assignments', 'PUT', { periodId: period.id, teacherId: id1, role: 'PEER', evaluatorIds: [id1] })).status, 400); ok('a teacher cannot be their own peer');

  // Assigned evaluators only
  assert.equal((await g3('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: id2, ...rub })).status, 403); ok('unassigned peer is refused');
  assert.equal((await kepsek('/api/sd/assignments', 'PUT', { periodId: period.id, teacherId: id2, role: 'PEER', evaluatorIds: [id3] })).status, 200);
  assert.equal((await g3('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: id2, ...rub })).status, 200); ok('assigned peer can submit');
  assert.equal((await g3('/api/sd/evaluations', 'POST', { type: 'PEER', targetId: id2, ...rub })).status, 409); ok('duplicate submission rejected');
  assert.equal((await g3('/api/sd/evaluations', 'POST', { type: 'KOORDINATOR', targetId: id2, ...rub })).status, 403); ok('a peer assignment does not allow a koordinator evaluation');

  // Supervisor + koordinator are separate records
  assert.equal((await kepsek('/api/sd/assignments', 'PUT', { periodId: period.id, teacherId: id2, role: 'SUPERVISOR', evaluatorIds: [(await staff('/api/me')).data.id] })).status, 200);
  assert.equal((await staff('/api/sd/evaluations', 'POST', { type: 'SUPERVISOR', targetId: id2, ...rub })).status, 200); ok('assigned supervisor can submit');
  const row = (await kepsek(`/api/sd/evaluations?periodId=${period.id}`)).data.find((r: any) => r.teacherId === id2);
  assert.equal(row.peer.submitted, 1); assert.equal(row.supervisor.submitted, 1); assert.equal(row.koordinator.submitted, 0); ok('peer and supervisor are stored and reported separately');

  // Removing an evaluator who already submitted keeps the evaluation
  assert.equal((await kepsek('/api/sd/assignments', 'PUT', { periodId: period.id, teacherId: id2, role: 'PEER', evaluatorIds: [] })).status, 200);
  assert.equal((await kepsek(`/api/sd/evaluations?periodId=${period.id}`)).data.find((r: any) => r.teacherId === id2).peer.submitted, 1); ok('removing a peer keeps the submitted evaluation');

  // Students only get what the VP assigned
  const sid = (await s1('/api/me')).data.id;
  assert.equal((await s1('/api/sd/evaluations', 'POST', { type: 'STUDENT', targetId: id1, ...(await answers(s1, true)) })).status, 403); ok('unassigned teacher refused for a student');
  assert.equal((await wakasis('/api/sd/student-assignments', 'PUT', { periodId: period.id, studentIds: [sid], teacherIds: [id1], mode: 'replace' })).status, 200);
  assert.deepEqual((await s1('/api/sd/my-tasks')).data.STUDENT.pending.map((p: any) => p.teacherId), [id1]); ok('student sees only the assigned teacher');
  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
