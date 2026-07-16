const { PrismaClient } = require('@prisma/client');

// Force Prisma's built-in, ultra-stable Rust engine to connect directly.
// No adapters, no dotenv, no OS fallback bugs.
const prisma = new PrismaClient({
  datasourceUrl: "mysql://root@127.0.0.1:3306/mdc_penilaian"
});

async function main() {
  console.log("Starting database seed for Staff & Karyawan YCHB...");

  // Clear old data
  await prisma.criterion.deleteMany();
  await prisma.rubric.deleteMany();

  // ---------------------------------------------------------
  // ASPEK A: KEROHANIAN
  // ---------------------------------------------------------

  // A.1 Kualitas Spiritual
  await prisma.rubric.create({
    data: {
      title: 'A.1 Kualitas Spiritual',
      criteria: {
        create: [
          { name: 'Aktif membangun kehidupan rohani yang teguh.', weight: 1 },
          { name: 'Mencari penyelesaian masalah secara Alkitabiah.', weight: 1 },
        ],
      },
    },
  });

  // A.2 Kualitas Karakter Mulia
  await prisma.rubric.create({
    data: {
      title: 'A.2 Kualitas Karakter Mulia',
      criteria: {
        create: [
          { name: '[KASIH] Peduli kepada rekan kerja', weight: 1 },
          { name: '[KASIH] Peduli kepada setiap anak (Penuh perhatian)', weight: 1 },
          { name: '[KASIH] Penuh perhatian terhadap lingkungan sekolah', weight: 1 },
          { name: '[SUKACITA] Bersyukur dalam segala hal', weight: 1 },
          { name: '[SUKACITA] Selalu riang', weight: 1 },
          { name: '[DAMAI SEJAHTERA] Percaya diri', weight: 1 },
          { name: '[DAMAI SEJAHTERA] Mandiri', weight: 1 },
          { name: '[DAMAI SEJAHTERA] Menunjukkan kestabilan emosi', weight: 1 },
          { name: '[KESABARAN] Sabar dalam segala hal', weight: 1 },
          { name: '[KESABARAN] Bekerja keras', weight: 1 },
          { name: '[KESABARAN] Toleransi', weight: 1 },
          { name: '[KESABARAN] Konsisten', weight: 1 },
          { name: '[KEMURAHAN] Suka memberi / berbagi', weight: 1 },
          { name: '[KEMURAHAN] Empaty', weight: 1 },
          { name: '[KEMURAHAN] Melakukan segala sesuatu tanpa pamrih (tulus)', weight: 1 },
          { name: '[KEBAIKAN] Jujur dalam mengelola suatu tugas', weight: 1 },
          { name: '[KEBAIKAN] Jujur dalam menyampaikan fakta yang ada', weight: 1 },
          { name: '[KEBAIKAN] Suka menolong', weight: 1 },
          { name: '[KEBAIKAN] Bekerjasama dengan tim untuk tujuan yang bermanfaat', weight: 1 },
          { name: '[KEBAIKAN] Memiliki tenggang rasa', weight: 1 },
          { name: '[KEBAIKAN] Rendah hati', weight: 1 },
          { name: '[KEBAIKAN] Ramah', weight: 1 },
          { name: '[KESETIAAN] Berbicara positif tentang sekolah dan pemimpin', weight: 1 },
          { name: '[KESETIAAN] Berbicara positif tentang murid', weight: 1 },
          { name: '[KESETIAAN] Berbicara positif tentang orang tua murid', weight: 1 },
          { name: '[KESETIAAN] Berbicara positif tentang rekan kerja', weight: 1 },
          { name: '[KESETIAAN] Bertanggung jawab atas tugas yang diberikan', weight: 1 },
          { name: '[KESETIAAN] Taat terhadap kebijakan sekolah', weight: 1 },
          { name: '[KESETIAAN] Berani menyampaikan ide untuk kemajuan sekolah', weight: 1 },
          { name: '[KELEMAHLEMBUTAN] Berkata bijak terhadap siapa saja', weight: 1 },
          { name: '[KELEMAHLEMBUTAN] Sopan santun dalam tindakan', weight: 1 },
          { name: '[KELEMAHLEMBUTAN] Cinta damai', weight: 1 },
          { name: '[PENGUASAAN DIRI] Disiplin dalam hal waktu', weight: 1 },
          { name: '[PENGUASAAN DIRI] Disiplin dalam hal mengerjakan tugas-tugas', weight: 1 },
          { name: '[PENGUASAAN DIRI] Menanggapi setiap masalah secara bijak', weight: 1 },
        ],
      },
    },
  });

  // A.3 Kualitas Karakter Pelaku Jasa
  await prisma.rubric.create({
    data: {
      title: 'A.3 Kualitas Karakter Pelaku Jasa',
      criteria: {
        create: [
          { name: '[SIAGA] Memahami apa yang terjadi di sekitar saya sehingga saya dapat menanggapi dengan benar.', weight: 1 },
          { name: '[HANDAL] Memenuhi apa yang saya sepakati untuk dikerjakan walaupun harus berkorban.', weight: 1 },
          { name: '[CERMAT] Mengetahui faktor apa yang akan mengurangi keefektifan pekerjaan atau kata-kata jika terabaikan.', weight: 1 },
          { name: '[RAJIN] Menggunakan waktu dan tenaga untuk menyelesaikan tugas yang dipercayakan kepada saya dengan segenap hati.', weight: 1 },
          { name: '[FLEKSIBILITAS] Kemauan untuk mengubah rencana / ide sesuai arahan pimpinan saya.', weight: 1 },
          { name: '[KETERSEDIAAN] Mengutamakan keinginan orang yang saya layani diatas jadwal dan prioritas saya sendiri', weight: 1 },
          { name: '[TABAH] Kekuatan dari dalam diri untuk menghadapi tekanan dan melakukan yang terbaik.', weight: 1 },
          { name: '[HORMAT] Menghargai para pemimpin karena otoritas lebih tinggi yang mereka miliki.', weight: 1 },
        ],
      },
    },
  });

  // ---------------------------------------------------------
  // ASPEK B: KECAKAPAN BEKERJA
  // ---------------------------------------------------------

  // B.1 Komunikasi dan Hubungan
  await prisma.rubric.create({
    data: {
      title: 'B.1 Komunikasi dan Hubungan',
      criteria: {
        create: [
          { name: 'Luwes', weight: 1 },
          { name: 'Sigap', weight: 1 },
          { name: 'Cepat tanggap dengan situasi sekitarnya', weight: 1 },
          { name: 'Semangat ketika menerima dan melakukan tugas', weight: 1 },
          { name: 'Menggunakan bahasa yang patut setiap saat', weight: 1 },
          { name: 'Mendengar dan menanggapi segala sesuatu dengan persuasif', weight: 1 },
          { name: 'Berkomunikasi dua arah dengan baik', weight: 1 },
          { name: 'Menjaga hubungan baik dengan rekan kerja', weight: 1 },
          { name: 'Menjaga hubungan baik dengan pemimpin', weight: 1 },
          { name: 'Menerima setiap orang dengan positif', weight: 1 },
        ],
      },
    },
  });

  // B.2 Menejemen Profesionalitas
  await prisma.rubric.create({
    data: {
      title: 'B.2 Menejemen Profesionalitas',
      criteria: {
        create: [
          { name: 'Menguasai tugas-tugas rutin', weight: 1 },
          { name: 'Bertanggung jawab menyelesaikan tugas-tugas rutin tepat waktu', weight: 1 },
          { name: 'Memberikan laporan / fakta secara benar', weight: 1 },
          { name: 'Menerima segala perubahan situasi dan kondisi dengan bijak', weight: 1 },
          { name: 'Mau berperan aktif pada acara sekolah', weight: 1 },
          { name: 'Dengan senang hati menyediakan kebutuhan orang lain.', weight: 1 },
          { name: 'Mampu mengetahui prioritas yang terpenting dalam kebutuhan sekolah', weight: 1 },
          { name: 'Mampu mendukung program-progam sekolah', weight: 1 },
        ],
      },
    },
  });

  // B.3 Penguasaan Bidang Pekerjaan
  await prisma.rubric.create({
    data: {
      title: 'B.3 Penguasaan Bidang Pekerjaan',
      criteria: {
        create: [
          { name: 'Tingkat kebenaran dalam menjalankan tugas', weight: 1 },
          { name: 'Teliti dalam menyelesaikan tugas', weight: 1 },
          { name: 'Rapi dalam menyelesaikan tugas', weight: 1 },
          { name: 'Tepat waktu dalam menyelesaikan tugas', weight: 1 },
          { name: 'Kebersihan dalam melakukan tugas', weight: 1 },
          { name: 'Hemat dalam segala sesuatu', weight: 1 },
          { name: 'Memanfaatkan apa yang ada untuk menyelesaikan tugas (tanpa harus membeli)', weight: 1 },
        ],
      },
    },
  });

  console.log("✅ STANDAR PERFORMA STAFF & KARYAWAN YCHB successfully seeded!");
}

main()
  .catch((e) => {
    console.error("CRITICAL ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });