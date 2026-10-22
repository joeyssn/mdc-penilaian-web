// Demo data for the SD teacher evaluation system. Safe to run more than once.
//   npx tsx prisma/seed-sd-groups.ts
// Run prisma/seed-sd.ts first (it creates sd.guru1 … sd.guru8 and the SD rubrics).
// Creates: an OPEN period, one published group (4A + 4B, 8 teachers, all partnerships),
// a principal, a vice principal for student affairs, a supervisor and 4 students. Password for all: sd12345
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'sd12345';

const PEOPLE = [
  { nis_niy: 'SD-P-01', name: 'Kepala Sekolah SD', email: 'sd.kepsek@mdc.sch.id', role: 'PRINCIPAL' as const, className: null },
  { nis_niy: 'SD-V-01', name: 'Wakasek Kesiswaan SD', email: 'sd.wakasis@mdc.sch.id', role: 'VICE_PRINCIPAL_KESISWAAN' as const, className: null },
  { nis_niy: 'SD-S-01', name: 'Pengawas SD', email: 'sd.pengawas@mdc.sch.id', role: 'STAFF' as const, className: null },
  { nis_niy: 'SD-K-01', name: 'Siswa Satu', email: 'sd.siswa1@mdc.sch.id', role: 'STUDENT' as const, className: '4A' },
  { nis_niy: 'SD-K-02', name: 'Siswa Dua', email: 'sd.siswa2@mdc.sch.id', role: 'STUDENT' as const, className: '4A' },
  { nis_niy: 'SD-K-03', name: 'Siswa Tiga', email: 'sd.siswa3@mdc.sch.id', role: 'STUDENT' as const, className: '4B' },
  { nis_niy: 'SD-K-04', name: 'Siswa Empat', email: 'sd.siswa4@mdc.sch.id', role: 'STUDENT' as const, className: '4B' },
];

// guru1..guru8 -> class + subject (one teacher per subject per class)
const ROSTER = [
  ['sd.guru1', '4A', 'MATEMATIKA'], ['sd.guru2', '4A', 'IPA'], ['sd.guru3', '4A', 'BAHASA_INDONESIA'], ['sd.guru4', '4A', 'PPKN'],
  ['sd.guru5', '4B', 'MATEMATIKA'], ['sd.guru6', '4B', 'IPA'], ['sd.guru7', '4B', 'BAHASA_INDONESIA'], ['sd.guru8', '4B', 'PPKN'],
] as const;
const PARTNER: Record<string, string> = { MATEMATIKA: 'IPA', IPA: 'MATEMATIKA', BAHASA_INDONESIA: 'PPKN', PPKN: 'BAHASA_INDONESIA' };

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const p of PEOPLE) {
    const data = { name: p.name, email: p.email, role: p.role, level: 'SD', className: p.className, password: hash };
    await prisma.user.upsert({ where: { nis_niy: p.nis_niy }, update: data, create: { nis_niy: p.nis_niy, ...data } });
  }
  const teachers = await prisma.user.findMany({ where: { email: { in: ROSTER.map(r => `${r[0]}@mdc.sch.id`) } } });
  if (teachers.length !== ROSTER.length) throw new Error('Run prisma/seed-sd.ts first: sd.guru1…sd.guru8 are missing.');
  const principal = (await prisma.user.findUnique({ where: { nis_niy: 'SD-P-01' } }))!;

  const period = await prisma.evalPeriod.upsert({ where: { name: 'Demo SD Semester' }, update: {}, create: { name: 'Demo SD Semester', status: 'OPEN' } });
  let group = await prisma.teacherGroup.findFirst({ where: { periodId: period.id, name: 'Kelompok 1' } });
  if (!group) group = await prisma.teacherGroup.create({ data: { name: 'Kelompok 1', periodId: period.id, classOne: '4A', classTwo: '4B', level: 'SD', createdById: principal.id } });

  for (const [login, className, subject] of ROSTER) {
    const t = teachers.find(x => x.email === `${login}@mdc.sch.id`)!;
    await prisma.groupMember.upsert({
      where: { groupId_className_subject: { groupId: group.id, className, subject } },
      update: { teacherId: t.id }, create: { groupId: group.id, teacherId: t.id, className, subject },
    });
  }
  const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
  for (const m of members) {
    const partner = members.find(x => x.className === m.className && x.subject === PARTNER[m.subject]);
    if (partner && m.partnerId !== partner.id) {
      await prisma.groupMember.update({ where: { id: m.id }, data: { partnerId: null } });
      await prisma.groupMember.update({ where: { id: m.id }, data: { partnerId: partner.id } });
    }
  }
  await prisma.teacherGroup.update({ where: { id: group.id }, data: { status: 'PUBLISHED' } });

  console.log('Done. Logins (password sd12345): sd.kepsek, sd.wakasis, sd.pengawas, sd.siswa1…4, sd.guru1…8');
  console.log('Group "Kelompok 1" = 4A + 4B, published, period "Demo SD Semester" is OPEN.');
  console.log('Next: log in as sd.kepsek → SD Groups & Supervisors → assign sd.pengawas to a teacher;');
  console.log('      log in as sd.wakasis → Student Assignments → assign teachers to students.');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
