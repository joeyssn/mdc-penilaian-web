// Adds dummy principals and vice principals for each school (TK, SD, SMP, SMA). Safe to run more than once.
//   npx tsx prisma/seed-leaders.ts          -> writes to your database
//   npx tsx prisma/seed-leaders.ts --dry    -> only prints what it would create
// Does not touch rubrics, scores or any other user. Do NOT use `prisma db seed` (it deletes rubrics).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DRY = process.argv.includes('--dry');
const PASSWORD = 'leader123';

const SCHOOLS = ['TK', 'SD', 'SMP', 'SMA'] as const;
const NAMES: Record<string, { principal: string; kur: string; kes: string }> = {
  TK:  { principal: 'Maria Kristina',  kur: 'Lilian Susanto',  kes: 'Yohana Pratiwi' },
  SD:  { principal: 'Daniel Hartono',  kur: 'Esther Wijaya',   kes: 'Samuel Gunawan' },
  SMP: { principal: 'Ruth Simanjuntak', kur: 'Andreas Tan',    kes: 'Naomi Sitompul' },
  SMA: { principal: 'Yosef Halim',     kur: 'Debora Lim',      kes: 'Timotius Chandra' },
};

const people = SCHOOLS.flatMap(s => {
  const k = s.toLowerCase();
  return [
    { school: s, role: 'PRINCIPAL' as const,                 name: NAMES[s].principal, user: `${k}.principal`, nis: `${s}-KS-01`, gender: 'Perempuan' },
    { school: s, role: 'VICE_PRINCIPAL_KURIKULUM' as const,  name: NAMES[s].kur,       user: `${k}.vp.kurikulum`, nis: `${s}-WK-01`, gender: 'Perempuan' },
    { school: s, role: 'VICE_PRINCIPAL_KESISWAAN' as const,  name: NAMES[s].kes,       user: `${k}.vp.kesiswaan`, nis: `${s}-WK-02`, gender: 'Laki-Laki' },
  ].map(p => ({ ...p, email: `${p.user}@mdc.sch.id` })); // log in by typing just e.g. sd.principal
});

async function main() {
  console.log('Login (type the short name, password for all: ' + PASSWORD + '):');
  for (const p of people) console.log(`  ${p.school.padEnd(3)} ${p.role.padEnd(26)} ${p.user.padEnd(20)} ${p.name}`);
  if (DRY) return console.log('\n--dry: nothing was written.');

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const p of people) {
      const data = { name: p.name, email: p.email, gender: p.gender, role: p.role, department: 'UMUM' as const, level: p.school, password: hash };
      await prisma.user.upsert({ where: { nis_niy: p.nis }, update: data, create: { nis_niy: p.nis, ...data } });
    }
    console.log(`\nDone: ${people.length} accounts (4 principals, 8 vice principals).`);
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exit(1); });
