// Adds dummy SD teachers and SD rubrics. Safe to run more than once.
//   npx tsx prisma/seed-sd.ts          -> writes to your database
//   npx tsx prisma/seed-sd.ts --dry    -> only prints what it would create
// Do NOT use `prisma db seed` for this: prisma/seed.ts deletes every rubric.
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DRY = process.argv.includes('--dry');
const PASSWORD = 'sd12345';

// Two groups of four. Group, subject and supervisor are NOT stored yet (no group tables exist);
// they are listed here only so you know who is who when the SD group screens are built.
const TEACHERS = [
  // Group 1
  { n: 1, name: 'Ani Wijaya',      gender: 'Perempuan', className: '4A', group: 1, cls: 'A', subject: 'Matematika (exact)',          supervisor: true },
  { n: 2, name: 'Budi Santoso',    gender: 'Laki-Laki', className: '4A', group: 1, cls: 'A', subject: 'Bahasa Indonesia (non-exact)' },
  { n: 3, name: 'Citra Lestari',   gender: 'Perempuan', className: '4B', group: 1, cls: 'B', subject: 'IPA (exact)' },
  { n: 4, name: 'Dedi Pranoto',    gender: 'Laki-Laki', className: '4B', group: 1, cls: 'B', subject: 'PPKn (non-exact)' },
  // Group 2
  { n: 5, name: 'Eka Putri',       gender: 'Perempuan', className: '5A', group: 2, cls: 'A', subject: 'Matematika (exact)',          supervisor: true },
  { n: 6, name: 'Fajar Nugroho',   gender: 'Laki-Laki', className: '5A', group: 2, cls: 'A', subject: 'Bahasa Indonesia (non-exact)' },
  { n: 7, name: 'Gita Maharani',   gender: 'Perempuan', className: '5B', group: 2, cls: 'B', subject: 'IPA (exact)' },
  { n: 8, name: 'Hendra Kusuma',   gender: 'Laki-Laki', className: '5B', group: 2, cls: 'B', subject: 'PPKn (non-exact)' },
].map(t => ({
  ...t,
  nis_niy: `SD-T-${String(t.n).padStart(2, '0')}`,
  email: `sd.guru${t.n}@mdc.sch.id`, // log in by typing just: sd.guru1
}));

type Indicator = string;
type Category = { title: string; indicators: Indicator[] };
type Section = { title: string; categories: Category[] };

const MAIN_RUBRIC: Section[] = [
  { title: 'A. Kerohanian dan Karakter', categories: [
    { title: 'A.1 Keteladanan', indicators: [
      'Menunjukkan sikap, tutur kata, dan perilaku yang menjadi teladan bagi siswa.',
      'Membangun kehidupan rohani yang bertumbuh dan terlihat dalam pekerjaannya.',
      'Bersikap jujur dan mau mengakui kesalahan dalam mengajar.',
    ]},
    { title: 'A.2 Kasih kepada Siswa', indicators: [
      'Peduli dan penuh perhatian kepada setiap siswa di kelasnya.',
      'Memperlakukan semua siswa dengan adil dan sabar.',
    ]},
  ]},
  { title: 'B. Perencanaan dan Pembelajaran', categories: [
    { title: 'B.1 Persiapan Mengajar', indicators: [
      'Menyiapkan rencana pembelajaran dan materi dengan baik sebelum mengajar.',
      'Menyiapkan alat peraga atau media yang sesuai dengan usia siswa SD.',
    ]},
    { title: 'B.2 Penyampaian Materi', indicators: [
      'Menguasai materi pelajaran yang diajarkan.',
      'Menjelaskan materi dengan jelas dan mudah dipahami siswa SD.',
      'Menggunakan metode yang bervariasi dan menyenangkan.',
      'Memberikan contoh nyata yang dekat dengan kehidupan sehari-hari siswa.',
    ]},
    { title: 'B.3 Penilaian Belajar', indicators: [
      'Memberikan umpan balik yang jelas dan tepat waktu kepada siswa.',
      'Menilai hasil belajar siswa secara adil dan sesuai tujuan pembelajaran.',
    ]},
  ]},
  { title: 'C. Pengelolaan Kelas', categories: [
    { title: 'C.1 Disiplin dan Suasana Kelas', indicators: [
      'Hadir dan memulai serta mengakhiri pelajaran tepat waktu.',
      'Menguasai kelas dan menegakkan kedisiplinan dengan kasih.',
      'Menciptakan suasana belajar yang aman dan menyenangkan.',
    ]},
  ]},
  { title: 'D. Kerja Sama dan Profesionalisme', categories: [
    { title: 'D.1 Kolaborasi', indicators: [
      'Bekerja sama dengan baik bersama rekan guru dalam satu kelompok.',
      'Terbuka terhadap masukan dan mau memperbaiki diri.',
      'Berkomunikasi dengan baik dan sopan kepada rekan kerja dan orang tua.',
    ]},
    { title: 'D.2 Tanggung Jawab', indicators: [
      'Menyelesaikan tugas administrasi guru tepat waktu.',
      'Berpenampilan rapi dan percaya diri sebagai pendidik.',
    ]},
  ]},
];

const SELF_RUBRIC: Section[] = [
  { title: 'A. Refleksi Diri', categories: [
    { title: 'A.1 Kerohanian dan Karakter', indicators: [
      'Saya berusaha menjadi teladan bagi siswa dalam sikap dan perilaku.',
      'Saya bertumbuh dalam kehidupan rohani dan menerapkannya dalam pekerjaan.',
    ]},
    { title: 'A.2 Pembelajaran', indicators: [
      'Saya menyiapkan rencana dan materi pembelajaran dengan baik.',
      'Saya menjelaskan materi dengan jelas dan memakai metode yang bervariasi.',
      'Saya memberikan umpan balik yang jelas kepada siswa.',
    ]},
    { title: 'A.3 Kelas dan Kerja Sama', indicators: [
      'Saya mengelola kelas dengan tertib dan penuh kasih.',
      'Saya bekerja sama dengan baik bersama rekan guru dan terbuka terhadap masukan.',
      'Saya menyelesaikan tugas dan administrasi tepat waktu.',
    ]},
  ]},
];

const RUBRICS = [
  {
    title: 'SD - Evaluasi Kinerja Guru',
    description: 'Rubrik evaluasi guru SD (rekan sejawat, supervisor, dan pimpinan). Skala 1-4.',
    evaluators: 'Teacher,Vice-Principal,Director/Principal',
    evaluatees: 'Teacher',
    isSelfReflection: false,
    sections: MAIN_RUBRIC,
  },
  {
    title: 'SD - Refleksi Diri Guru',
    description: 'Rubrik refleksi diri guru SD. Skala 1-4.',
    evaluators: 'Teacher',
    evaluatees: 'Teacher',
    isSelfReflection: true,
    sections: SELF_RUBRIC,
  },
];

async function main() {
  console.log(`\nSD teachers (password for all: ${PASSWORD})`);
  console.table(TEACHERS.map(t => ({
    login: t.email.replace('@mdc.sch.id', ''), name: t.name, class: t.className,
    group: t.group, 'group class': t.cls, subject: t.subject, supervisor: t.supervisor ? 'yes' : '',
  })));
  for (const r of RUBRICS) {
    const indicators = r.sections.reduce((a, s) => a + s.categories.reduce((b, c) => b + c.indicators.length, 0), 0);
    console.log(`Rubric "${r.title}": ${r.sections.length} sections, ${indicators} indicators`);
  }
  if (DRY) return console.log('\n--dry: nothing was written.');

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const t of TEACHERS) {
      const data = {
        name: t.name, email: t.email, gender: t.gender, role: 'TEACHER' as const,
        department: 'UMUM' as const, level: 'SD', className: t.className, password: hash,
      };
      await prisma.user.upsert({ where: { nis_niy: t.nis_niy }, update: data, create: { nis_niy: t.nis_niy, ...data } });
    }
    console.log(`\nTeachers ready: ${TEACHERS.length}`);

    for (const r of RUBRICS) {
      const exists = await prisma.rubric.findFirst({ where: { title: r.title } });
      if (exists) { console.log(`Rubric already exists, skipped: ${r.title}`); continue; }
      const now = new Date();
      await prisma.rubric.create({
        data: {
          id: randomUUID(), title: r.title, description: r.description,
          evaluators: r.evaluators, evaluatees: r.evaluatees, isSelfReflection: r.isSelfReflection,
          intendedForRole: 'TEACHER', updatedAt: now,
          rubricsection: {
            create: r.sections.map((s, si) => ({
              id: randomUUID(), title: s.title, order: si + 1, updatedAt: now,
              rubriccategory: {
                create: s.categories.map((c, ci) => ({
                  id: randomUUID(), title: c.title, order: ci + 1, updatedAt: now,
                  rubricindicator: {
                    create: c.indicators.map((text, ii) => ({
                      id: randomUUID(), text, order: ii + 1, weight: 1, updatedAt: now,
                    })),
                  },
                })),
              },
            })),
          },
        },
      });
      console.log(`Rubric created: ${r.title}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });