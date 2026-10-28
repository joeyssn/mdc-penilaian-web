// Demo data for the SD evaluation assignments. Safe to run more than once.
//   npx tsx prisma/seed-sd.ts              (teachers sd.guru1…8 + SD rubrics)  <- run this first
//   npx tsx prisma/seed-sd-assignments.ts
// Creates an OPEN period, a principal (sd.kepsek), a vice principal for student affairs (sd.wakasis),
// a staff member (sd.pengawas), 4 students, and example assignments. Password for all: sd12345
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PEOPLE = [
  { nis_niy: 'SD-P-01', name: 'Kepala Sekolah SD', email: 'sd.kepsek@mdc.sch.id', role: 'PRINCIPAL' as const, className: null },
  { nis_niy: 'SD-V-01', name: 'Wakasek Kesiswaan SD', email: 'sd.wakasis@mdc.sch.id', role: 'VICE_PRINCIPAL_KESISWAAN' as const, className: null },
  { nis_niy: 'SD-S-01', name: 'Pengawas SD', email: 'sd.pengawas@mdc.sch.id', role: 'STAFF' as const, className: null },
  { nis_niy: 'SD-K-01', name: 'Siswa Satu', email: 'sd.siswa1@mdc.sch.id', role: 'STUDENT' as const, className: '4A' },
  { nis_niy: 'SD-K-02', name: 'Siswa Dua', email: 'sd.siswa2@mdc.sch.id', role: 'STUDENT' as const, className: '4A' },
  { nis_niy: 'SD-K-03', name: 'Siswa Tiga', email: 'sd.siswa3@mdc.sch.id', role: 'STUDENT' as const, className: '4B' },
  { nis_niy: 'SD-K-04', name: 'Siswa Empat', email: 'sd.siswa4@mdc.sch.id', role: 'STUDENT' as const, className: '4B' },
];

async function main() {
  const hash = await bcrypt.hash('sd12345', 10);
  for (const p of PEOPLE) {
    const data = { name: p.name, email: p.email, role: p.role, level: 'SD', className: p.className, password: hash };
    await prisma.user.upsert({ where: { nis_niy: p.nis_niy }, update: data, create: { nis_niy: p.nis_niy, ...data } });
  }
  const teachers = await prisma.user.findMany({ where: { email: { startsWith: 'sd.guru' } }, orderBy: { email: 'asc' } });
  if (teachers.length < 3) throw new Error('Run prisma/seed-sd.ts first: sd.guru1…sd.guru8 are missing.');
  const kepsek = (await prisma.user.findUnique({ where: { nis_niy: 'SD-P-01' } }))!;
  const staff = (await prisma.user.findUnique({ where: { nis_niy: 'SD-S-01' } }))!;
  const period = await prisma.evalPeriod.upsert({ where: { name: 'Demo SD Semester' }, update: {}, create: { name: 'Demo SD Semester', status: 'OPEN' } });

  // Example: guru1 is supervised by the staff member, evaluated by guru2 and guru3 as peers, and guru4 is the koordinator
  const [g1, g2, g3, g4] = teachers;
  const rows = [
    { teacherId: g1.id, evaluatorId: staff.id, role: 'SUPERVISOR' as const },
    { teacherId: g1.id, evaluatorId: g2.id, role: 'PEER' as const },
    { teacherId: g1.id, evaluatorId: g3.id, role: 'PEER' as const },
    { teacherId: g1.id, evaluatorId: (g4 ?? g3).id, role: 'KOORDINATOR' as const },
  ];
  for (const r of rows) {
    await prisma.teacherAssignment.upsert({
      where: { periodId_teacherId_evaluatorId_role: { periodId: period.id, ...r } },
      update: { active: true }, create: { periodId: period.id, ...r, assignedById: kepsek.id },
    });
  }
  console.log('Done. Logins (password sd12345): sd.kepsek, sd.wakasis, sd.pengawas, sd.siswa1…4, sd.guru1…8');
  console.log('Period "Demo SD Semester" is OPEN. Log in as sd.kepsek → Assign Evaluators to change who evaluates whom.');
  console.log('Log in as sd.wakasis → Student Assignments to give students their teachers.');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
