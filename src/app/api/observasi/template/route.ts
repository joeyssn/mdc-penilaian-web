import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// The default fallback template (loads if the admin hasn't edited anything yet)
const DEFAULT_TEMPLATE = [
  {
    id: 'A',
    title: 'A. Persiapan Materi',
    indicators: [
      { id: 'A1', text: 'Guru menyiapkan materi mengajar dengan baik' },
      { id: 'A2', text: 'Guru menyiapkan materi dalam bentuk tayangan? Memakai alat peraga/LCD atau materi internet' },
      { id: 'A3', text: 'Guru memberikan pengantar sebelum masuk pada materi pokok berupa contoh nyata sehari-hari yang terkait dengan materi pelajaran' },
      { id: 'A4', text: 'Guru menyampaikan tujuan/manfaat pada setiap awal kompetensi dasar' },
    ]
  },
  {
    id: 'B',
    title: 'B. Penyampaian',
    indicators: [
      { id: 'B1', text: 'Guru menguasai materi pelajaran' },
      { id: 'B2', text: 'Guru menerangkan dengan jelas dan mudah dipahami' },
      { id: 'B3', text: 'Guru dapat memotivasi / mengugah minat belajar siswa (rasa ingin tahu siswa)' },
      { id: 'B4', text: 'Guru mengajar dengan suara yang jelas' },
      { id: 'B5', text: 'Guru mengunakan metode yang bervariasi' },
      { id: 'B6', text: 'Guru dapat menciptakan suasana belajar yang menyengkan dikelas' },
      { id: 'B7', text: 'Guru menjawab pertanyaan siswa dengan baik (sikap+caranya)' },
      { id: 'B8', text: 'Guru berusaha mendapatkan feedback dari siswa tentang pemahaman materi yang disampaikan' },
      { id: 'B9', text: 'Guru menerapkan teknik bertanya yang baik' },
      { id: 'B10', text: 'Guru menggunakan bahasa yang baik dan benar' },
      { id: 'B11', text: 'Guru dapat menutup pelajaran dengan baik (memberikan rangkuman / menekankan kembali / memberikan PR) / Ketercapaian tujuan' },
    ]
  },
  {
    id: 'C',
    title: 'C. Disiplin dan Penampilan',
    indicators: [
      { id: 'C1', text: 'Guru hadir dan meningalkan kelas tepat waktu sesuai jadwal' },
      { id: 'C2', text: 'Guru dapat menguasai kelas dan menegakkan kedisiplinan' },
      { id: 'C3', text: 'Guru menjadi contoh/keteladan dalam hal bersikap, tutur kata dan tingkah laku' },
      { id: 'C4', text: 'Guru bersedia mengakui secara terbuka/jujur (meralat) bila terjadi kesalahan mengajar' },
      { id: 'C5', text: 'Guru mengajar dengan penampilan yang baik (kerapian berbusana) dan memiliki percaya diri' },
      { id: 'C6', text: 'Guru dapat mengatur waktu kegiatan pembelajaran secara professional dan sistematis' },
    ]
  }
];

export async function GET() {
  try {
    const template = await prisma.observationTemplate.findFirst();
    return NextResponse.json(template ? template.content : DEFAULT_TEMPLATE);
  } catch (error) {
    console.error("TEMPLATE GET ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const content = await req.json();
    const existing = await prisma.observationTemplate.findFirst();
    
    if (existing) {
      await prisma.observationTemplate.update({
        where: { id: existing.id },
        data: { content }
      });
    } else {
      await prisma.observationTemplate.create({
        data: { content }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TEMPLATE POST ERROR:", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}