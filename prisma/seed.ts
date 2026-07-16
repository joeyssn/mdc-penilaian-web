import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "mdc_penilaian",
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Clearing old data...");
  await prisma.rubric.deleteMany();

  console.log("Seeding full Staff & Karyawan rubric...");

  await prisma.rubric.create({
    data: {
      title: "Standard Performa Staff & Karyawan",

      sections: {
        create: [
          // ==========================================
          // SECTION 1: KEROHANIAN
          // ==========================================
          {
            title: "A. Kerohanian",
            order: 1,
            categories: {
              create: [
                // CATEGORY: A.1 Kualitas Spiritual
                {
                  title: "A.1 Kualitas Spiritual",
                  order: 1,
                  indicators: {
                    create: [
                      { text: "Aktif membangun kehidupan rohani yang teguh.", order: 1, weight: 1 },
                      { text: "Mencari penyelesaian masalah secara Alkitabiah.", order: 2, weight: 1 },
                    ],
                  },
                },
                // CATEGORY: A.2 Kualitas Karakter Mulia
                {
                  title: "A.2 Kualitas Karakter Mulia",
                  order: 2,
                  indicators: {
                    create: [
                      { text: "[KASIH] Peduli kepada rekan kerja", order: 1, weight: 1 },
                      { text: "[KASIH] Peduli kepada setiap anak (Penuh perhatian)", order: 2, weight: 1 },
                      { text: "[KASIH] Penuh perhatian terhadap lingkungan sekolah", order: 3, weight: 1 },
                      { text: "[SUKACITA] Bersyukur dalam segala hal", order: 4, weight: 1 },
                      { text: "[SUKACITA] Selalu riang", order: 5, weight: 1 },
                      { text: "[DAMAI SEJAHTERA] Percaya diri", order: 6, weight: 1 },
                      { text: "[DAMAI SEJAHTERA] Mandiri", order: 7, weight: 1 },
                      { text: "[DAMAI SEJAHTERA] Menunjukkan kestabilan emosi", order: 8, weight: 1 },
                      { text: "[KESABARAN] Sabar dalam segala hal", order: 9, weight: 1 },
                      { text: "[KESABARAN] Bekerja keras", order: 10, weight: 1 },
                      { text: "[KESABARAN] Toleransi", order: 11, weight: 1 },
                      { text: "[KESABARAN] Konsisten", order: 12, weight: 1 },
                      { text: "[KEMURAHAN] Suka memberi / berbagi", order: 13, weight: 1 },
                      { text: "[KEMURAHAN] Empaty", order: 14, weight: 1 },
                      { text: "[KEMURAHAN] Melakukan segala sesuatu tanpa pamrih (tulus)", order: 15, weight: 1 },
                      { text: "[KEBAIKAN] Jujur dalam mengelola suatu tugas", order: 16, weight: 1 },
                      { text: "[KEBAIKAN] Jujur dalam menyampaikan fakta yang ada", order: 17, weight: 1 },
                      { text: "[KEBAIKAN] Suka menolong", order: 18, weight: 1 },
                      { text: "[KEBAIKAN] Bekerjasama dengan tim untuk tujuan yang bermanfaat", order: 19, weight: 1 },
                      { text: "[KEBAIKAN] Memiliki tenggang rasa", order: 20, weight: 1 },
                      { text: "[KEBAIKAN] Rendah hati", order: 21, weight: 1 },
                      { text: "[KEBAIKAN] Ramah", order: 22, weight: 1 },
                      { text: "[KESETIAAN] Berbicara positif tentang sekolah dan pemimpin", order: 23, weight: 1 },
                      { text: "[KESETIAAN] Berbicara positif tentang murid", order: 24, weight: 1 },
                      { text: "[KESETIAAN] Berbicara positif tentang orang tua murid", order: 25, weight: 1 },
                      { text: "[KESETIAAN] Berbicara positif tentang rekan kerja", order: 26, weight: 1 },
                      { text: "[KESETIAAN] Bertanggung jawab atas tugas yang diberikan", order: 27, weight: 1 },
                      { text: "[KESETIAAN] Taat terhadap kebijakan sekolah", order: 28, weight: 1 },
                      { text: "[KESETIAAN] Berani menyampaikan ide untuk kemajuan sekolah", order: 29, weight: 1 },
                      { text: "[KELEMAHLEMBUTAN] Berkata bijak terhadap siapa saja", order: 30, weight: 1 },
                      { text: "[KELEMAHLEMBUTAN] Sopan santun dalam tindakan", order: 31, weight: 1 },
                      { text: "[KELEMAHLEMBUTAN] Cinta damai", order: 32, weight: 1 },
                      { text: "[PENGUASAAN DIRI] Disiplin dalam hal waktu", order: 33, weight: 1 },
                      { text: "[PENGUASAAN DIRI] Disiplin dalam hal mengerjakan tugas-tugas", order: 34, weight: 1 },
                      { text: "[PENGUASAAN DIRI] Menanggapi setiap masalah secara bijak", order: 35, weight: 1 },
                    ],
                  },
                },
                // CATEGORY: A.3 Kualitas Karakter Pelaku Jasa
                {
                  title: "A.3 Kualitas Karakter Pelaku Jasa",
                  order: 3,
                  indicators: {
                    create: [
                      { text: "[SIAGA] Memahami apa yang terjadi di sekitar saya sehingga saya dapat menanggapi dengan benar.", order: 1, weight: 1 },
                      { text: "[HANDAL] Memenuhi apa yang saya sepakati untuk dikerjakan walaupun harus berkorban.", order: 2, weight: 1 },
                      { text: "[CERMAT] Mengetahui faktor apa yang akan mengurangi keefektifan pekerjaan atau kata-kata jika terabaikan.", order: 3, weight: 1 },
                      { text: "[RAJIN] Menggunakan waktu dan tenaga untuk menyelesaikan tugas yang dipercayakan kepada saya dengan segenap hati.", order: 4, weight: 1 },
                      { text: "[FLEKSIBILITAS] Kemauan untuk mengubah rencana / ide sesuai arahan pimpinan saya.", order: 5, weight: 1 },
                      { text: "[KETERSEDIAAN] Mengutamakan keinginan orang yang saya layani diatas jadwal dan prioritas saya sendiri", order: 6, weight: 1 },
                      { text: "[TABAH] Kekuatan dari dalam diri untuk menghadapi tekanan dan melakukan yang terbaik.", order: 7, weight: 1 },
                      { text: "[HORMAT] Menghargai para pemimpin karena otoritas lebih tinggi yang mereka miliki.", order: 8, weight: 1 },
                    ],
                  },
                },
              ],
            },
          },

          // ==========================================
          // SECTION 2: KECAKAPAN BEKERJA
          // ==========================================
          {
            title: "B. Kecakapan Bekerja",
            order: 2,
            categories: {
              create: [
                // CATEGORY: B.1 Komunikasi dan Hubungan
                {
                  title: "B.1 Komunikasi dan Hubungan",
                  order: 1,
                  indicators: {
                    create: [
                      { text: "Luwes", order: 1, weight: 1 },
                      { text: "Sigap", order: 2, weight: 1 },
                      { text: "Cepat tanggap dengan situasi sekitarnya", order: 3, weight: 1 },
                      { text: "Semangat ketika menerima dan melakukan tugas", order: 4, weight: 1 },
                      { text: "Menggunakan bahasa yang patut setiap saat", order: 5, weight: 1 },
                      { text: "Mendengar dan menanggapi segala sesuatu dengan persuasif", order: 6, weight: 1 },
                      { text: "Berkomunikasi dua arah dengan baik", order: 7, weight: 1 },
                      { text: "Menjaga hubungan baik dengan rekan kerja", order: 8, weight: 1 },
                      { text: "Menjaga hubungan baik dengan pemimpin", order: 9, weight: 1 },
                      { text: "Menerima setiap orang dengan positif", order: 10, weight: 1 },
                    ],
                  },
                },
                // CATEGORY: B.2 Menejemen Profesionalitas
                {
                  title: "B.2 Menejemen Profesionalitas",
                  order: 2,
                  indicators: {
                    create: [
                      { text: "Menguasai tugas-tugas rutin", order: 1, weight: 1 },
                      { text: "Bertanggung jawab menyelesaikan tugas-tugas rutin tepat waktu", order: 2, weight: 1 },
                      { text: "Memberikan laporan / fakta secara benar", order: 3, weight: 1 },
                      { text: "Menerima segala perubahan situasi dan kondisi dengan bijak", order: 4, weight: 1 },
                      { text: "Mau berperan aktif pada acara sekolah", order: 5, weight: 1 },
                      { text: "Dengan senang hati menyediakan kebutuhan orang lain.", order: 6, weight: 1 },
                      { text: "Mampu mengetahui prioritas yang terpenting dalam kebutuhan sekolah", order: 7, weight: 1 },
                      { text: "Mampu mendukung program-progam sekolah", order: 8, weight: 1 },
                    ],
                  },
                },
                // CATEGORY: B.3 Penguasaan Bidang Pekerjaan
                {
                  title: "B.3 Penguasaan Bidang Pekerjaan",
                  order: 3,
                  indicators: {
                    create: [
                      { text: "Tingkat kebenaran dalam menjalankan tugas", order: 1, weight: 1 },
                      { text: "Teliti dalam menyelesaikan tugas", order: 2, weight: 1 },
                      { text: "Rapi dalam menyelesaikan tugas", order: 3, weight: 1 },
                      { text: "Tepat waktu dalam menyelesaikan tugas", order: 4, weight: 1 },
                      { text: "Kebersihan dalam melakukan tugas", order: 5, weight: 1 },
                      { text: "Hemat dalam segala sesuatu", order: 6, weight: 1 },
                      { text: "Memanfaatkan apa yang ada untuk menyelesaikan tugas (tanpa harus membeli)", order: 7, weight: 1 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("✅ Seed completed successfully! All 70 items injected.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });