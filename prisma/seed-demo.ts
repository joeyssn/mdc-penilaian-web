// Replaces ALL earlier dummy accounts with one fresh, complete test set.
//
//   npx tsx prisma/seed-demo.ts --dry     -> prints what would be erased and created, touches nothing
//   npx tsx prisma/seed-demo.ts --yes     -> erases the old dummy accounts, then creates the new demo set
//
// What is erased: ONLY accounts created by the earlier seed scripts (nis_niy starting with SD-T-, SD-P-, SD-V-, SD-S-, SD-K-, MG-,
// TK-/SD-/SMP-/SMA-KS- or -WK-) and by this script (DM-), plus their scores, evaluations, assignments, absences and observations.
// Real accounts, rubrics, weights and settings are never touched. Do NOT use `prisma db seed` (it deletes rubrics).
//
// Everyone logs in by typing the short name (before the @) with the password 123, e.g. demo.sd.principal
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DRY = process.argv.includes('--dry');
const YES = process.argv.includes('--yes');
const PASSWORD = '123';
const PERIOD = 'Demo Semester';
const OLD = [/^SD-(T|P|V|S|K)-/, /^MG-/, /^(TK|SD|SMP|SMA)-(KS|WK)-/, /^DM-/];

type Role = 'ADMIN' | 'DIRECTOR' | 'PRINCIPAL' | 'VICE_PRINCIPAL_KURIKULUM' | 'VICE_PRINCIPAL_KESISWAAN' | 'IT' | 'PR' | 'ACC' | 'TEACHER' | 'STAFF' | 'HRD' | 'KARYAWAN' | 'STUDENT';
type P = { user: string; name: string; role: Role; level?: string; division?: string; className?: string; gender?: string };

const SCHOOLS = ['TK', 'SD', 'SMP', 'SMA'] as const;
const FIRST = ['Adi', 'Bima', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kirana', 'Lina', 'Maya', 'Nanda', 'Okta', 'Putri', 'Rafi', 'Sari', 'Tono', 'Umar'];
let n = 0;
const nm = (tag: string) => `${FIRST[n++ % FIRST.length]} ${tag}`;

const people: P[] = [];
const add = (p: P) => people.push(p);

// Management and workers (global, not tied to one school)
add({ user: 'demo.director', name: 'Direktur Demo', role: 'DIRECTOR' });
add({ user: 'demo.hrd', name: 'HRD Demo', role: 'HRD' });
add({ user: 'demo.admin', name: 'Admin Demo', role: 'ADMIN', division: 'ADMIN' });
for (const d of ['it', 'pr', 'acc'] as const) for (const i of [1, 2, 3]) add({ user: `demo.${d}${i}`, name: nm(d.toUpperCase()), role: d.toUpperCase() as Role, division: d.toUpperCase() });
add({ user: 'demo.staff.admin1', name: nm('Staff Admin'), role: 'STAFF', division: 'ADMIN' });
add({ user: 'demo.staff.admin2', name: nm('Staff Admin'), role: 'STAFF', division: 'ADMIN' });
for (const i of [1, 2, 3, 4]) add({ user: `demo.karyawan${i}`, name: nm('Karyawan'), role: 'KARYAWAN', level: SCHOOLS[i - 1] });

// Every school: principal, two vice principals, 4 teachers, a staff member and students
for (const s of SCHOOLS) {
  const k = s.toLowerCase();
  add({ user: `demo.${k}.principal`, name: `Kepala ${s}`, role: 'PRINCIPAL', level: s });
  add({ user: `demo.${k}.vp.kurikulum`, name: `Wakasek Kurikulum ${s}`, role: 'VICE_PRINCIPAL_KURIKULUM', level: s });
  add({ user: `demo.${k}.vp.kesiswaan`, name: `Wakasek Kesiswaan ${s}`, role: 'VICE_PRINCIPAL_KESISWAAN', level: s });
  const small = s === 'TK' || s === 'SD';
  for (let i = 1; i <= 4; i++) {
    const cls = small ? (i <= 2 ? `${s === 'TK' ? 'B' : '4'}A` : `${s === 'TK' ? 'B' : '4'}B`) : (i <= 2 ? (s === 'SMP' ? '8A' : '11A') : (s === 'SMP' ? '8B' : '11B'));
    add({ user: `demo.${k}.guru${i}`, name: nm(`Guru ${s}`), role: 'TEACHER', level: s, className: cls });
  }
  add({ user: `demo.${k}.staff`, name: nm(`Staff ${s}`), role: 'STAFF', level: s });
  const classes = [...new Set(people.filter(p => p.role === 'TEACHER' && p.level === s).map(p => p.className!))];
  for (const c of classes) for (let i = 1; i <= 3; i++) add({ user: `demo.${k}.siswa.${c.toLowerCase()}${i}`, name: nm(`Siswa ${c}`), role: 'STUDENT', level: s, className: c });
}

const nis = (p: P) => `DM-${p.user}`;
const email = (p: P) => `${p.user}@mdc.sch.id`;
const by = (pred: (p: P) => boolean) => people.filter(pred);
const one = (user: string) => people.find(p => p.user === user)!;

async function main() {
  console.log(`Erases old dummy accounts matching: ${OLD.map(r => r.source).join('  ')}`);
  if (process.argv.includes('--list')) { for (const p of people) console.log(`${p.role.padEnd(26)} ${(p.level ?? '').padEnd(4)} ${email(p).padEnd(36)} ${PASSWORD}  ${p.name}`); return; }
  console.log(`Creates ${people.length} accounts (${by(p => p.role === 'STUDENT').length} students). Password for everyone: ${PASSWORD}\n`);
  console.log('Management : demo.director  demo.hrd  demo.admin');
  console.log('Workers    : demo.it1-3  demo.pr1-3  demo.acc1-3  demo.staff.admin1-2   Karyawan: demo.karyawan1-4');
  for (const s of SCHOOLS) console.log(`${s.padEnd(4)}       : demo.${s.toLowerCase()}.principal  .vp.kurikulum  .vp.kesiswaan  .guru1-4  .staff  .siswa.<class>1-3`);
  if (DRY || !YES) return console.log('\nNothing was changed. Run again with --yes to erase the old dummy data and create this set.');

  const prisma = new PrismaClient();
  try {
    // 1. erase the old dummy accounts and everything that points to them
    const all = await prisma.user.findMany({ select: { id: true, nis_niy: true } });
    const gone = all.filter(u => OLD.some(r => r.test(u.nis_niy))).map(u => u.id);
    if (gone.length) {
      await prisma.score.deleteMany({ where: { OR: [{ graderId: { in: gone } }, { targetId: { in: gone } }] } });
      await prisma.evaluationlog.deleteMany({ where: { OR: [{ graderId: { in: gone } }, { targetId: { in: gone } }] } });
      await prisma.observation.deleteMany({ where: { OR: [{ targetId: { in: gone } }, { observerId: { in: gone } }] } });
      await prisma.absence.deleteMany({ where: { userId: { in: gone } } });
      await prisma.user.deleteMany({ where: { id: { in: gone } } }); // assignments and SD evaluations cascade
    }
    console.log(`\nErased ${gone.length} old dummy accounts.`);

    // 2. create the new set
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const p of people) {
      const data = { name: p.name, email: email(p), gender: p.gender ?? null, role: p.role, department: 'UMUM' as const, level: p.level ?? null, division: p.division ?? null, className: p.className ?? null, password: hash };
      await prisma.user.upsert({ where: { nis_niy: nis(p) }, update: data, create: { nis_niy: nis(p), ...data } });
    }
    const id = new Map((await prisma.user.findMany({ where: { nis_niy: { startsWith: 'DM-' } }, select: { id: true, nis_niy: true } })).map(u => [u.nis_niy, u.id]));
    const uid = (user: string) => id.get(`DM-${user}`)!;

    // 3. an open period with ready-made assignments so every screen has something to test
    const period = await prisma.evalPeriod.upsert({ where: { name: PERIOD }, update: { status: 'OPEN' }, create: { name: PERIOD, status: 'OPEN' } });
    const admin = uid('demo.admin');
    const link = (teacher: string, evaluator: string, role: 'SUPERVISOR' | 'PEER' | 'KOORDINATOR') =>
      prisma.teacherAssignment.upsert({
        where: { periodId_teacherId_evaluatorId_role: { periodId: period.id, teacherId: uid(teacher), evaluatorId: uid(evaluator), role } },
        update: { active: true }, create: { periodId: period.id, teacherId: uid(teacher), evaluatorId: uid(evaluator), role, assignedById: admin },
      });
    let links = 0; const L = async (t: string, e: string, r: 'SUPERVISOR' | 'PEER' | 'KOORDINATOR') => { await link(t, e, r); links++; };

    for (const s of SCHOOLS) {
      const k = s.toLowerCase();
      const teachers = [1, 2, 3, 4].map(i => `demo.${k}.guru${i}`);
      for (const t of teachers) {
        await L(t, `demo.${k}.principal`, 'SUPERVISOR');
        await L(t, `demo.${k}.vp.kurikulum`, 'KOORDINATOR');
        for (const o of teachers.filter(x => x !== t).slice(0, 2)) await L(t, o, 'PEER');
        await L(t, 'demo.hrd', 'PEER'); // HRD can be a peer anywhere
      }
      for (const vp of ['vp.kurikulum', 'vp.kesiswaan']) { // the director picks the principal, the other VP is a peer
        await L(`demo.${k}.${vp}`, `demo.${k}.principal`, 'SUPERVISOR');
        await L(`demo.${k}.${vp}`, `demo.${k}.${vp === 'vp.kurikulum' ? 'vp.kesiswaan' : 'vp.kurikulum'}`, 'PEER');
      }
    }
    // heads chosen by the director, workers evaluated by their head and a peer of the same team
    const heads: Record<string, string> = { IT: 'demo.it1', PR: 'demo.pr1', ACC: 'demo.acc1', ADMIN: 'demo.admin', HRD: 'demo.hrd' };
    for (const [div, head] of Object.entries(heads)) await prisma.appSetting.upsert({ where: { key: `divisionHead:${div}` }, update: { value: uid(head) }, create: { key: `divisionHead:${div}`, value: uid(head) } });
    for (const div of ['IT', 'PR', 'ACC']) for (const i of [2, 3]) { const d = div.toLowerCase(); await L(`demo.${d}${i}`, `demo.${d}1`, 'SUPERVISOR'); await L(`demo.${d}${i}`, `demo.${d}${i === 2 ? 3 : 2}`, 'PEER'); }
    await L('demo.staff.admin1', 'demo.admin', 'SUPERVISOR'); await L('demo.staff.admin2', 'demo.admin', 'SUPERVISOR'); await L('demo.staff.admin1', 'demo.staff.admin2', 'PEER');
    for (const i of [2, 3, 4]) { await L(`demo.karyawan${i}`, 'demo.karyawan1', 'SUPERVISOR'); await L(`demo.karyawan${i}`, 'demo.hrd', 'PEER'); }
    console.log(`Assignments: ${links} for period "${PERIOD}" (OPEN).`);

    // 4. attendance scores so the Attendance card has values
    await prisma.absence.deleteMany({ where: { userId: { in: [...id.values()] } } });
    const staffy = people.filter(p => !['STUDENT'].includes(p.role));
    await prisma.absence.createMany({ data: staffy.map((p, i) => ({ userId: uid(p.user), userName: p.name, role: p.role, attendanceScore: [4, 3.8, 3.5, 3.2, 4, 3.9][i % 6] })) });
    console.log(`Attendance: ${staffy.length} records.\n\nDone. Log in with e.g. demo.sd.principal / ${PASSWORD}`);
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exit(1); });
