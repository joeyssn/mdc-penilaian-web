// Dummy accounts for the Director / management / HRD / SMP-SMA assignment screens. Safe to run more than once.
//   npx tsx prisma/seed-management.ts          -> writes to your database
//   npx tsx prisma/seed-management.ts --dry    -> only prints what it would create
// Needs `npx prisma db push` first (the IT / PR / ACC roles and the division column).
// Does not touch rubrics, scores or other users. Do NOT use `prisma db seed` (it deletes rubrics).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DRY = process.argv.includes('--dry');
const PASSWORD = 'mgmt123';

type P = { user: string; name: string; role: string; gender: 'Laki-Laki' | 'Perempuan'; level?: string; division?: string; note?: string };
const P = (user: string, name: string, role: string, gender: 'Laki-Laki' | 'Perempuan', extra: Partial<P> = {}): P => ({ user, name, role, gender, ...extra });

const PEOPLE: P[] = [
  P('director', 'Harianto Wibowo', 'DIRECTOR', 'Laki-Laki'),
  P('hrd', 'Sari Anggraini', 'HRD', 'Perempuan'),
  P('hrd2', 'Rina Marlina', 'HRD', 'Perempuan'),

  // Division teams: IT, PR and ACC are roles; ADMIN and HRD are roles too; STAFF takes its division from the Division field.
  P('it1', 'Rizky Pratama', 'IT', 'Laki-Laki'), P('it2', 'Bayu Setiawan', 'IT', 'Laki-Laki'), P('it3', 'Dimas Kurniawan', 'IT', 'Laki-Laki'),
  P('pr1', 'Clara Natalia', 'PR', 'Perempuan'), P('pr2', 'Felicia Tan', 'PR', 'Perempuan'), P('pr3', 'Gabriel Hutapea', 'PR', 'Laki-Laki'),
  P('acc1', 'Lestari Wulandari', 'ACC', 'Perempuan'), P('acc2', 'Hendro Susilo', 'ACC', 'Laki-Laki'), P('acc3', 'Maya Puspita', 'ACC', 'Perempuan'),
  // ADMIN accounts get a school so they are limited to it (an ADMIN with no school would be a central admin with access to everything).
  P('admin1', 'Yulia Rahmawati', 'ADMIN', 'Perempuan', { level: 'SMP' }), P('admin2', 'Indra Gunawan', 'ADMIN', 'Laki-Laki', { level: 'SMA' }),
  P('staff.it', 'Joko Prasetyo', 'STAFF', 'Laki-Laki', { division: 'IT', level: 'SMP' }),
  P('staff.pr', 'Wulan Sari', 'STAFF', 'Perempuan', { division: 'PR', level: 'SMA' }),
  P('staff.acc', 'Tono Wibisono', 'STAFF', 'Laki-Laki', { division: 'ACC', level: 'SD' }),

  // Karyawan across schools; one is the OB.
  P('karyawan1', 'Slamet Riyadi', 'KARYAWAN', 'Laki-Laki', { level: 'SD', note: 'OB' }),
  P('karyawan2', 'Parjo Santoso', 'KARYAWAN', 'Laki-Laki', { level: 'SMP' }),
  P('karyawan3', 'Sumiati', 'KARYAWAN', 'Perempuan', { level: 'SMA' }),
  P('karyawan4', 'Tarmin Hadi', 'KARYAWAN', 'Laki-Laki', { level: 'TK' }),

  // SMP and SMA staff and teachers (for the SMP / SMA principal and vice principal assignment screens)
  P('smp.guru1', 'Anita Kusuma', 'TEACHER', 'Perempuan', { level: 'SMP' }),
  P('smp.guru2', 'Bagas Wicaksono', 'TEACHER', 'Laki-Laki', { level: 'SMP' }),
  P('smp.guru3', 'Citra Ayu', 'TEACHER', 'Perempuan', { level: 'SMP' }),
  P('smp.staff1', 'Dewi Lestari', 'STAFF', 'Perempuan', { level: 'SMP', division: 'ADMIN' }),
  P('sma.guru1', 'Eko Saputra', 'TEACHER', 'Laki-Laki', { level: 'SMA' }),
  P('sma.guru2', 'Fitri Handayani', 'TEACHER', 'Perempuan', { level: 'SMA' }),
  P('sma.guru3', 'Galih Permana', 'TEACHER', 'Laki-Laki', { level: 'SMA' }),
  P('sma.staff1', 'Hesti Rahayu', 'STAFF', 'Perempuan', { level: 'SMA', division: 'ADMIN' }),
];

const email = (u: string) => `${u}@mdc.sch.id`; // log in by typing just the short name

async function main() {
  console.log(`Login with the short name; password for all: ${PASSWORD}`);
  for (const p of PEOPLE) console.log(`  ${p.user.padEnd(12)} ${p.role.padEnd(9)} ${p.name}${p.level ? ` · ${p.level}` : ''}${p.division ? ` · ${p.division}` : ''}${p.note ? ` · ${p.note}` : ''}`);
  if (DRY) return console.log('\n--dry: nothing was written.');

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const p of PEOPLE) {
      const data: any = { name: p.name, email: email(p.user), gender: p.gender, role: p.role, department: 'UMUM', level: p.level ?? null, division: p.division ?? null, password: hash };
      await prisma.user.upsert({ where: { nis_niy: `MG-${p.user}` }, update: data, create: { nis_niy: `MG-${p.user}`, ...data } });
    }
    console.log(`\nDone: ${PEOPLE.length} accounts.`);

    // The assignment screens need a period that is open or in draft.
    const live = await prisma.evalPeriod.findFirst({ where: { status: { in: ['OPEN', 'DRAFT'] } } });
    if (!live) { await prisma.evalPeriod.create({ data: { name: 'Demo Management Semester', status: 'DRAFT' } }); console.log('Created a DRAFT period "Demo Management Semester".'); }
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exit(1); });
