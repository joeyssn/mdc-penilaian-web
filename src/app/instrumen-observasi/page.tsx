'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type User = { id: string; name: string; role: string; gender?: string | null; };

const FALLBACK_TEMPLATE = [
  {
    id: 'A', title: 'A. Persiapan Materi',
    indicators: [
      { id: 'A1', text: 'Guru menyiapkan materi mengajar dengan baik' },
      { id: 'A2', text: 'Guru menyiapkan materi dalam bentuk tayangan? Memakai alat peraga/LCD atau materi internet' },
      { id: 'A3', text: 'Guru memberikan pengantar sebelum masuk pada materi pokok berupa contoh nyata sehari-hari yang terkait dengan materi pelajaran' },
      { id: 'A4', text: 'Guru menyampaikan tujuan/manfaat pada setiap awal kompetensi dasar' },
    ]
  },
  {
    id: 'B', title: 'B. Penyampaian',
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
    id: 'C', title: 'C. Disiplin dan Penampilan',
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

export default function InstrumenObservasiPage() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [observationCategories, setObservationCategories] = useState<any[]>([]);
  const [editModeId, setEditModeId] = useState<string | null>(null);

  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [tanggalPengamatan, setTanggalPengamatan] = useState('');
  const [kelas, setKelas] = useState('');
  const [bidangStudi, setBidangStudi] = useState('');
  const [lamaPengamatan, setLamaPengamatan] = useState('');
  const [materiPokok, setMateriPokok] = useState('');

  const [scores, setScores] = useState<Record<string, number>>({});
  const [catatanPositif, setCatatanPositif] = useState('');
  const [catatanDitingkatkan, setCatatanDitingkatkan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const meRes = await fetch('/api/me');
      if (!meRes.ok) throw new Error("Not logged in");
      const meData = await meRes.json();
      setLoggedInUser(meData);

      const role = (meData.role || '').toUpperCase();
      if (role !== 'PRINCIPAL' && role !== 'VICE_PRINCIPAL_KURIKULUM' && role !== 'ADMIN') {
        router.push('/login'); 
        return;
      }

      // Fetch Template
      try {
        const tplRes = await fetch('/api/observasi/template');
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          setObservationCategories(tplData && tplData.length > 0 ? tplData : FALLBACK_TEMPLATE);
        } else {
          setObservationCategories(FALLBACK_TEMPLATE);
        }
      } catch (e) {
        setObservationCategories(FALLBACK_TEMPLATE);
      }

      // Fetch Observations & Edit Data
      const obsRes = await fetch('/api/observasi');
      const obsData = await obsRes.json();
      
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('id');
      
      if (editId) {
        const existingRecord = obsData.find((o: any) => o.id === editId);
        if (existingRecord) {
          setEditModeId(existingRecord.id);
          setSelectedTeacherId(existingRecord.targetId);
          setTanggalPengamatan(existingRecord.date);
          setKelas(existingRecord.kelas);
          setBidangStudi(existingRecord.subject);
          setLamaPengamatan(existingRecord.duration);
          setMateriPokok(existingRecord.topic);
          setScores(existingRecord.scores);
          setCatatanPositif(existingRecord.notesPositive);
          setCatatanDitingkatkan(existingRecord.notesImprovement);
        }
      }

      // 🚀 THE FIX: Find who the logged-in user has already observed
      const myObservedIds = obsData
        .filter((o: any) => o.observerId === meData.id && o.id !== editId)
        .map((o: any) => o.targetId);

      // Fetch Targets and Remove Already Observed ones
      const tRes = await fetch('/api/vice-principal/targets');
      const tData = await tRes.json();
      if (!tData.error) {
        setTeachers(tData.filter((t: User) => {
          const r = (t.role || '').toUpperCase();
          const isTargetable = r !== 'STUDENT' && r !== 'DIRECTOR' && r !== 'ADMIN' && r !== 'PRINCIPAL';
          const notAlreadyObserved = !myObservedIds.includes(t.id);
          return isTargetable && notAlreadyObserved;
        }));
      }

    } catch (error) {
      console.error(error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (indicatorId: string, value: number) => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const getAverages = () => {
    let sumA = 0, countA = 0; let sumB = 0, countB = 0; let sumC = 0, countC = 0;

    Object.entries(scores).forEach(([id, val]) => {
      if (id.startsWith('A')) { sumA += val; countA++; }
      if (id.startsWith('B')) { sumB += val; countB++; }
      if (id.startsWith('C')) { sumC += val; countC++; }
    });

    const avgA = countA > 0 ? sumA / countA : 0;
    const avgB = countB > 0 ? sumB / countB : 0;
    const avgC = countC > 0 ? sumC / countC : 0;
    const totalNA = (avgA + (2 * avgB) + avgC) / 4;

    return { avgA, avgB, avgC, totalNA };
  };

  const submitObservation = async (e: FormEvent) => {
    e.preventDefault();
    
    const totalQuestions = observationCategories.reduce((acc, cat) => acc + cat.indicators.length, 0);
    if (Object.keys(scores).length < totalQuestions) {
      alert("Mohon lengkapi semua penilaian (0-4) sebelum menyimpan.");
      return;
    }

    if (!selectedTeacherId || !loggedInUser) {
      alert("Pilih Guru/Staff yang diobservasi!");
      return;
    }

    setIsSubmitting(true);
    
    const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
    const { totalNA } = getAverages();

    const payload = {
      ...(editModeId && { id: editModeId }),
      targetId: selectedTeacherId,
      targetName: targetTeacher?.name || 'Unknown',
      observerId: loggedInUser.id,
      observerName: loggedInUser.name,
      date: tanggalPengamatan,
      kelas: kelas,
      subject: bidangStudi,
      duration: lamaPengamatan,
      topic: materiPokok,
      scores: scores,
      notesPositive: catatanPositif,
      notesImprovement: catatanDitingkatkan,
      finalScore: totalNA
    };

    try {
      const method = editModeId ? 'PUT' : 'POST';
      const res = await fetch('/api/observasi', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(editModeId ? "Perubahan berhasil disimpan!" : "Instrumen Observasi berhasil dibuat!");
        router.back(); 
      } else {
        alert("Gagal menyimpan data ke server.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Memuat data...</div>;
  const { avgA, avgB, avgC, totalNA } = getAverages();

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-4 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 gap-4 md:gap-0">
        <div className="flex items-center w-full md:w-auto justify-between">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-8 md:h-12 w-auto" priority />
           <button onClick={() => router.back()} className="md:hidden text-gray-600 font-bold text-sm">Kembali</button>
        </div>
        <div className="hidden md:flex gap-10 text-[15px] font-medium text-gray-800">
           <button onClick={() => router.back()} className="text-gray-600 hover:text-black font-medium transition-colors">Batal & Kembali</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-20 space-y-8">
        <div className="bg-[#053b50] rounded-2xl px-6 py-8 md:p-10 text-white shadow-lg text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            {editModeId ? 'Edit Instrumen Observasi' : 'Instrumen Observasi Kelas'}
          </h1>
          <p className="text-white/80 text-sm md:text-base">SMA Kristen Masa Depan Cerah</p>
          <div className="mt-4 inline-block bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10 text-xs md:text-sm">
            <span className="font-bold text-[#e99a24]">Skor: </span> 0: Sangat Kurang, 1: Kurang, 2: Cukup, 3: Baik, 4: Sangat Baik
          </div>
        </div>

        <form onSubmit={submitObservation} className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200"><h3 className="font-bold text-gray-800 text-lg">Data Observasi</h3></div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Nama Guru/Staff (Observe)</label>
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#008c99]/50">
                  <option value="">-- Pilih Target --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role.replace('_', ' ')})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Tanggal Pengamatan</label>
                <input type="date" value={tanggalPengamatan} onChange={(e) => setTanggalPengamatan(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Kelas Target</label>
                <input type="text" placeholder="Contoh: X IPA 1" value={kelas} onChange={(e) => setKelas(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Bidang Studi</label>
                <input type="text" placeholder="Mata Pelajaran" value={bidangStudi} onChange={(e) => setBidangStudi(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Lama Pengamatan</label>
                <input type="text" placeholder="Contoh: 2x45 Menit" value={lamaPengamatan} onChange={(e) => setLamaPengamatan(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Materi Pokok</label>
                <input type="text" placeholder="Topik materi..." value={materiPokok} onChange={(e) => setMateriPokok(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white outline-none" />
              </div>
            </div>
          </div>

          {observationCategories.map((category) => (
            <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">{category.title}</h3>
                <div className="bg-[#008c99] text-white text-xs font-bold px-3 py-1 rounded-full">
                  Rata-rata: {category.id === 'A' ? avgA.toFixed(2) : category.id === 'B' ? avgB.toFixed(2) : avgC.toFixed(2)}
                </div>
              </div>
              <div className="p-4 md:p-6 divide-y divide-gray-100">
                {category.indicators.map((indicator: any) => (
                  <div key={indicator.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <p className="text-gray-700 font-medium lg:w-2/3 text-sm md:text-base leading-snug">{indicator.text}</p>
                    <div className="flex flex-wrap gap-2 shrink-0 bg-gray-50 p-1.5 rounded-lg border border-gray-200 shadow-sm justify-center">
                      {[0, 1, 2, 3, 4].map((val) => (
                        <label key={val} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-md cursor-pointer font-bold transition-all ${scores[indicator.id] === val ? 'bg-[#e99a24] text-white shadow-md transform scale-105' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
                          <input type="radio" name={indicator.id} value={val} className="hidden" onChange={() => handleScoreChange(indicator.id, val)} required />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200"><h3 className="font-bold text-gray-800 text-lg">Catatan Supervisor</h3></div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <label className="font-bold text-green-700">Hal Positif yang perlu dipertahankan:</label>
                <textarea value={catatanPositif} onChange={(e) => setCatatanPositif(e.target.value)} required className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white outline-none min-h-[100px] resize-none"></textarea>
              </div>
              <div className="space-y-2">
                <label className="font-bold text-red-600">Hal yang perlu ditingkatkan:</label>
                <textarea value={catatanDitingkatkan} onChange={(e) => setCatatanDitingkatkan(e.target.value)} required className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white outline-none min-h-[100px] resize-none"></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">Nilai Akhir (NA)</p>
              <p className="text-4xl font-extrabold text-[#053b50]">{totalNA > 0 ? totalNA.toFixed(2) : '-.--'}</p>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-[#008c99] hover:bg-[#007b87] text-white font-extrabold text-lg px-12 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : (editModeId ? 'Update Observasi' : 'Simpan Observasi')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}