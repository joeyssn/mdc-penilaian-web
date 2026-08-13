'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

type User = { id: string; name: string; role: string; gender?: string | null; department?: string; };
type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { id: string; title: string; evaluators: string[]; evaluatees: string[]; sections: Section[] };
type ScoreStats = { average: number; totalEvaluations: number; letterGrade: string; };
type MyScores = { peer: ScoreStats; student: ScoreStats; };
type ReportRow = { id: string; name: string; role: string; department: string; studentCount: number; peerCount: number; selfCount: number; studentAvg: string; peerAvg: string; selfAvg: string; overallAvg: string; };

type Observation = {
  id: string; targetId: string; targetName: string; observerId: string; observerName: string;
  date: string; kelas: string; subject: string; duration: string; topic: string;
  scores: Record<string, number>; notesPositive: string; notesImprovement: string; finalScore: number;
  isApproved: boolean; 
};

type GroupedObservation = {
  targetId: string;
  targetName: string;
  kelas: string;
  subject: string;
  averageScore: number;
  records: Observation[];
};

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

export default function UnifiedDirectorDashboard() {
  const [activeTab, setActiveTab] = useState<'personal' | 'overview' | 'observasi'>('personal');

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [myScores, setMyScores] = useState<MyScores | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedEvals, setCompletedEvals] = useState<Set<string>>(new Set());
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [scores, setScores] = useState<Record<string, 'A'|'B'|'C'|'D'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(true);

  const [groupedObservations, setGroupedObservations] = useState<GroupedObservation[]>([]);
  const [selectedGroupedObs, setSelectedGroupedObs] = useState<GroupedObservation | null>(null);
  const [observationTemplate, setObservationTemplate] = useState<any[]>([]);
  const [isObsLoading, setIsObsLoading] = useState(true);

  useEffect(() => {
    fetchPersonalData();
    fetchOverviewData();
    fetchObservations();
  }, []);

  const fetchPersonalData = async () => {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      setLoggedInUser(meData);
      const compRes = await fetch(`/api/evaluate/completed?graderId=${meData.id}`);
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompletedEvals(new Set(compData)); 
      }
    }
    const scoreRes = await fetch('/api/me/scores');
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      if (!scoreData.error) setMyScores(scoreData);
    }
    const tRes = await fetch('/api/teachers');
    const tData = await tRes.json();
    if (!tData.error) setTeachers(tData);

    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    if (!rData.error) setRubrics(rData);
  };

  const fetchOverviewData = async () => {
    try {
      const res = await fetch('/api/director/report');
      const data = await res.json();
      if (!data.error) setReportData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsReportLoading(false);
    }
  };

  const fetchObservations = async () => {
    try {
      try {
        const tplRes = await fetch('/api/observasi/template');
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          setObservationTemplate(tplData && tplData.length > 0 ? tplData : FALLBACK_TEMPLATE);
        } else {
          setObservationTemplate(FALLBACK_TEMPLATE);
        }
      } catch (e) {
        setObservationTemplate(FALLBACK_TEMPLATE);
      }

      const res = await fetch('/api/observasi');
      const data = await res.json();
      
      if (!data.error) {
        // 🚀 THE FIX: ONLY PROCESS OBSERVATIONS THAT THE PRINCIPAL HAS APPROVED!
        const approvedData = data.filter((obs: Observation) => obs.isApproved === true);

        const grouped = approvedData.reduce((acc: any, obs: Observation) => {
          if (!acc[obs.targetId]) {
            acc[obs.targetId] = {
              targetId: obs.targetId,
              targetName: obs.targetName,
              kelas: obs.kelas,
              subject: obs.subject,
              records: [],
            };
          }
          acc[obs.targetId].records.push(obs);
          return acc;
        }, {});

        const groupedArray: GroupedObservation[] = Object.values(grouped).map((g: any) => ({
          ...g,
          averageScore: g.records.reduce((sum: number, r: Observation) => sum + r.finalScore, 0) / g.records.length
        }));

        setGroupedObservations(groupedArray);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsObsLoading(false);
    }
  };

  const getTitle = (gender?: string | null) => {
    if (gender === 'Laki-Laki') return 'Mr. ';
    if (gender === 'Perempuan') return "Ma'am ";
    return '';
  };

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return '';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF') return 'Staff';
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return dbRole;
  };

  const isSelfReflectionRule = (r: Rubric) => {
    const requiredRoles = ["Teacher", "Staff", "Vice-Principal", "Director/Principal"];
    const excludedRoles = ["Admin", "Student"];
    const hasRequired = requiredRoles.every(role => r.evaluators?.includes(role) && r.evaluatees?.includes(role));
    const hasExcluded = excludedRoles.some(role => r.evaluators?.includes(role) || r.evaluatees?.includes(role));
    return hasRequired && !hasExcluded;
  };

  const handleScoreChange = (indicatorId: string, value: 'A'|'B'|'C'|'D') => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !loggedInUser) return;
    const scoreArray = Object.entries(scores).map(([indicatorId, value]) => ({ indicatorId, value }));
    if (scoreArray.length === 0) { alert("Please score at least one indicator before submitting."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graderId: loggedInUser.id, targetId: selectedTarget.id, scores: scoreArray }),
      });
      if (res.ok) {
        alert("Evaluation submitted successfully!");
        setCompletedEvals(prev => new Set(prev).add(selectedTarget.id));
        setSelectedTarget(null);
        setScores({}); 
      } else { alert("Failed to submit evaluation."); }
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const filteredTeachers = teachers.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch || !loggedInUser || target.id === loggedInUser.id) return false;
    if (loggedInUser.role === 'PRINCIPAL') return target.role === 'TEACHER' || target.role === 'STAFF' || target.role === 'VICE_PRINCIPAL';
    if (loggedInUser.role === 'VICE_PRINCIPAL') return target.role === 'VICE_PRINCIPAL' || target.role === 'TEACHER' || target.role === 'STAFF';
    return target.role === 'PRINCIPAL' || target.role === 'VICE_PRINCIPAL' || target.role === 'TEACHER' || target.role === 'STAFF';
  });

  let activeRubric: Rubric | null = null;
  if (loggedInUser && selectedTarget) {
    const myRole = getNormalizedRole(loggedInUser.role);
    const targetRole = getNormalizedRole(selectedTarget.role);
    activeRubric = rubrics.find(r => r.evaluators?.includes(myRole) && r.evaluatees?.includes(targetRole) && !isSelfReflectionRule(r)) || null;
  }

  let overallAvg = 0;
  if (myScores) {
    const totalEvals = myScores.peer.totalEvaluations + myScores.student.totalEvaluations;
    if (totalEvals > 0) overallAvg = ((myScores.peer.average * myScores.peer.totalEvaluations) + (myScores.student.average * myScores.student.totalEvaluations)) / totalEvals;
  }

  // --- PRINT VIEW FOR COMBINED OBSERVATION ---
  if (activeTab === 'observasi' && selectedGroupedObs) {
    return (
      <div className="min-h-screen bg-gray-200 py-10 print:bg-white print:py-0 font-serif">
        <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-md">
          <button onClick={() => setSelectedGroupedObs(null)} className="text-gray-600 font-bold bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200">← Back to List</button>
          <button onClick={() => window.print()} className="bg-[#053b50] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#032635] flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Export to PDF
          </button>
        </div>

        <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 text-black">
          <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Observasi Kelas (Gabungan)</h1>
            <h2 className="text-xl font-bold mt-1">SMA Kristen Masa Depan Cerah</h2>
          </div>

          <table className="w-full mb-6 text-sm">
            <tbody>
              <tr><td className="w-48 font-bold py-1">Nama Guru (Observe)</td><td className="w-4">:</td><td className="py-1">{selectedGroupedObs.targetName}</td></tr>
              <tr><td className="w-48 font-bold py-1">Kelas</td><td className="w-4">:</td><td className="py-1">{selectedGroupedObs.kelas}</td></tr>
              <tr><td className="w-48 font-bold py-1">Bidang studi</td><td className="w-4">:</td><td className="py-1">{selectedGroupedObs.subject}</td></tr>
            </tbody>
          </table>

          <div className="mb-6 border border-black p-4 text-center bg-gray-50 print:bg-transparent flex justify-center items-center gap-4">
            <span className="font-bold text-lg">Nilai Akhir Rata-Rata (NA):</span>
            <span className="text-3xl font-extrabold text-[#053b50]">{selectedGroupedObs.averageScore.toFixed(2)}</span>
          </div>

          {selectedGroupedObs.records.map((rec, index) => (
            <div key={rec.id} className="mb-10 border-2 border-gray-400 p-6 text-sm rounded-lg break-inside-avoid shadow-sm print:shadow-none print:border-black relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-gray-300 pb-2 gap-2">
                <h3 className="font-bold text-lg">
                  Supervisor {index + 1}: {rec.observerName} <span className="text-gray-500 text-sm font-normal">({rec.date})</span>
                </h3>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#e99a24] text-base">Skor Asli: {rec.finalScore.toFixed(2)}</span>
                  <span className="bg-green-100 text-green-700 border border-green-300 px-3 py-1 rounded text-sm font-bold flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Approved
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-bold mb-2">Rincian Penilaian (Skala 0-4):</h4>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200">
                      <th className="border border-gray-300 px-3 py-2 text-left">Aspek yang Dinilai</th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-24">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observationTemplate.map((cat: any) => (
                      <React.Fragment key={cat.id}>
                        <tr className="bg-gray-50 print:bg-gray-100">
                          <td colSpan={2} className="border border-gray-300 px-3 py-2 font-bold text-gray-800">{cat.title}</td>
                        </tr>
                        {cat.indicators.map((ind: any) => (
                          <tr key={ind.id}>
                            <td className="border border-gray-300 px-3 py-2 pl-6 text-gray-700">{ind.text}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-base">
                              {rec.scores?.[ind.id] !== undefined ? rec.scores[ind.id] : '-'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                 <div>
                    <p className="font-bold text-green-700 print:text-black mb-1">Hal Positif yang perlu dipertahankan:</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{rec.notesPositive}</p>
                 </div>
                 <div>
                    <p className="font-bold text-red-600 print:text-black mb-1">Hal yang perlu ditingkatkan:</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{rec.notesImprovement}</p>
                 </div>
              </div>
            </div>
          ))}

          <div className="mt-16 pt-8 text-sm text-center flex justify-between break-inside-avoid">
            <div>
              <p className="mb-16">Mengetahui,<br/>Kepala SMA Kr MDC</p>
              <p className="font-bold underline">Dra. Liem Sioe Ie</p>
            </div>
            <div className="text-right">
              <p className="mb-16">Surabaya, {new Date().toLocaleDateString('id-ID')}<br/>Director / Reviewer</p>
              <p className="font-bold underline">_________________________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans print:bg-white">
      
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 print:hidden gap-4">
        <div className="flex items-center">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex gap-8 text-[15px] font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button onClick={() => setActiveTab('personal')} className={`pb-1 transition-all border-b-2 ${activeTab === 'personal' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>
            My Evaluation
          </button>
          <button onClick={() => setActiveTab('overview')} className={`pb-1 transition-all border-b-2 ${activeTab === 'overview' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>
            School Overview
          </button>
          <button onClick={() => setActiveTab('observasi')} className={`pb-1 transition-all border-b-2 ${activeTab === 'observasi' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>
            Observation Track Record
          </button>
        </div>

        <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
      </nav>

      {/* TAB 1: PERSONAL EVALUATION */}
      {activeTab === 'personal' && (
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-20 space-y-12 animate-in fade-in duration-300">
          <div>
            {loggedInUser && (<h1 className="text-4xl font-extrabold text-[#053b50] mb-8">Hi, Welcome {getTitle(loggedInUser.gender)}{loggedInUser.name}</h1>)}

            {myScores && (
              <>
                <div className="bg-[#e99a24] rounded-2xl px-8 py-6 text-white flex justify-between items-center mb-6 shadow-sm">
                  <div><h2 className="text-2xl font-bold tracking-wide">Overall Evaluation Rating</h2><p className="text-sm font-medium opacity-90 mt-1">Based on student & peer feedback</p></div>
                  <div className="text-right"><div className="text-5xl font-extrabold tracking-tight">{overallAvg > 0 ? overallAvg.toFixed(1) : '-.-'}</div><div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                    <h3 className="text-2xl font-extrabold text-black">Peer Rating</h3>
                    <p className="text-gray-700 font-medium mb-8">Feedback from colleagues</p>
                    <div className="flex justify-between items-end mb-3">
                      <div className="text-4xl font-extrabold text-gray-500 tracking-tight">{myScores.peer.average > 0 ? myScores.peer.average.toFixed(1) : '-.-'}<span className="text-xl text-gray-500 font-bold">/4.0</span></div>
                      <div className="text-sm font-bold text-gray-500">({myScores.peer.totalEvaluations} participant)</div>
                    </div>
                    <div className="w-full bg-[#e6e6e6] rounded-full h-3.5"><div className="bg-gray-500 h-3.5 rounded-full transition-all duration-1000" style={{ width: `${(myScores.peer.average / 4) * 100}%` }}></div></div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                    <h3 className="text-2xl font-extrabold text-black">Student Rating</h3>
                    <p className="text-gray-700 font-medium mb-8">Feedback from students</p>
                    <div className="flex justify-between items-end mb-3">
                      <div className="text-4xl font-extrabold text-[#008c99] tracking-tight">{myScores.student.average > 0 ? myScores.student.average.toFixed(1) : '-.-'}<span className="text-xl text-[#008c99] font-bold">/4.0</span></div>
                      <div className="text-sm font-bold text-[#008c99]">({myScores.student.totalEvaluations} participant)</div>
                    </div>
                    <div className="w-full bg-[#e6e6e6] rounded-full h-3.5"><div className="bg-[#008c99] h-3.5 rounded-full transition-all duration-1000" style={{ width: `${(myScores.student.average / 4) * 100}%` }}></div></div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <Link href="/self-reflection" className="w-full bg-[#053b50] hover:bg-[#032635] text-white font-bold py-4 rounded-xl shadow-md flex justify-center transition-all">Complete Self-Reflection</Link>
                </div>
              </>
            )}
          </div>

          <div className="pt-10 border-t border-gray-200">
            <div><h2 className="text-3xl font-extrabold text-[#053b50]">Peer Evaluation Portal</h2><p className="text-gray-500 mt-2 text-lg">Select a colleague below to begin scoring.</p></div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mt-6">
              <div className="flex items-center px-8 py-5 border-b border-gray-100 bg-gray-50">
                <svg className="w-6 h-6 text-gray-400 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search for a Colleague..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-gray-800 text-xl font-bold placeholder:text-gray-400 bg-transparent" autoComplete="off" />
              </div>

              {searchQuery && (
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredTeachers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-bold">No results found.</div>
                  ) : (
                    filteredTeachers.map(teacher => {
                      const hasEvaluated = completedEvals.has(teacher.id);
                      return (
                        <div key={teacher.id} onClick={() => !hasEvaluated && setSelectedTarget(teacher)} className={`p-4 px-8 flex items-center justify-between transition-colors border-b border-gray-100 last:border-b-0 ${hasEvaluated ? 'opacity-60 bg-gray-50' : 'hover:bg-[#008c99]/5 cursor-pointer group'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${hasEvaluated ? 'bg-gray-200 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>{teacher.name.charAt(0)}</div>
                            <div>
                              <h3 className={`font-bold text-lg transition-colors ${hasEvaluated ? 'text-gray-500' : 'text-gray-900 group-hover:text-[#008c99]'}`}>{getTitle(teacher.gender)}{teacher.name}</h3>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">{teacher.role}</p>
                            </div>
                          </div>
                          {hasEvaluated ? (
                            <button disabled className="bg-gray-100 text-gray-400 border-2 border-gray-200 px-4 py-2 rounded-lg font-bold text-sm cursor-not-allowed">Completed</button>
                          ) : (
                            <button className="bg-white border-2 border-[#e99a24] text-[#e99a24] group-hover:bg-[#e99a24] group-hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">Evaluate</button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {selectedTarget && (
              <div className="mt-8">
                {!activeRubric ? (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center shadow-sm">
                    <h3 className="text-lg font-bold text-red-700">No Rubric Assigned</h3>
                    <p className="text-red-600 mt-2">There is no rubric assigned for evaluating this specific role.</p>
                    <button onClick={() => setSelectedTarget(null)} className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-red-700">Go Back</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-[#008c99] px-8 py-6 text-white flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                        <p className="text-[#008c99] text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 font-medium">Rubric: {activeRubric.title}</p>
                      </div>
                      <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-lg transition-colors text-sm">Cancel</button>
                    </div>

                    <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
                      {(activeRubric.sections || []).map((section) => (
                        <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-gray-100 px-6 py-3 border-b border-gray-200"><h3 className="font-bold text-gray-800 text-lg">{section.title}</h3></div>
                          <div className="p-6 space-y-8">
                            {(section.categories || []).map((category) => (
                              <div key={category.id} className="space-y-4">
                                <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm border-b border-gray-100 pb-2">{category.title}</h4>
                                <div className="space-y-4">
                                  {(category.indicators || []).map((indicator) => (
                                    <div key={indicator.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                      <p className="text-gray-700 font-medium md:w-2/3 leading-snug">{indicator.text}</p>
                                      <div className="flex gap-2 shrink-0 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                        {['A', 'B', 'C', 'D'].map((val) => (
                                          <label key={val} className={`flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold transition-all ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}>
                                            <input type="radio" name={indicator.id} value={val} className="hidden" onChange={() => handleScoreChange(indicator.id, val as 'A'|'B'|'C'|'D')} required />
                                            {val}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="pt-6 border-t border-gray-200 flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="bg-[#e99a24] hover:bg-[#d68a1f] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isSubmitting ? 'Saving Scores...' : 'Submit Evaluation'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SCHOOL OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8 animate-in fade-in duration-300 print:p-0 print:pt-4">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#053b50]">School-Wide Overview</h1>
              <p className="text-gray-500 mt-2 font-medium print:hidden">Monitor evaluation performance across the entire staff.</p>
              <p suppressHydrationWarning className="hidden print:block text-gray-500 mt-2 font-medium">Generated on: {new Date().toLocaleDateString('en-GB')}</p>
            </div>
            <button onClick={() => window.print()} className="bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 print:hidden flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Export Data
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
            {isReportLoading ? (
              <div className="p-12 text-center text-gray-500 font-bold">Generating Report...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                      <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Staff Name</th>
                      <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Role & Dept</th>
                      <th className="py-4 px-4 font-bold text-[#008c99] uppercase text-xs tracking-wider text-center">Student<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                      <th className="py-4 px-4 font-bold text-[#f39c12] uppercase text-xs tracking-wider text-center">Peer<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                      <th className="py-4 px-4 font-bold text-purple-600 uppercase text-xs tracking-wider text-center">Self<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                      <th className="py-4 px-4 font-bold text-green-600 uppercase text-xs tracking-wider text-center">Observation<br/><span className="text-[10px] text-gray-400 font-normal">Principal/VP Avg</span></th>
                      <th className="py-4 px-6 font-bold text-gray-800 uppercase text-xs tracking-wider text-center">Overall Avg<br/><span className="text-[10px] text-gray-400 font-normal">(Scale 1-4)</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.map((row) => {
                      const obsGroup = groupedObservations.find(g => g.targetId === row.id);
                      const obsAvg = obsGroup ? obsGroup.averageScore.toFixed(2) : '-';

                      return (
                        <tr key={row.id} className="hover:bg-gray-50 print:hover:bg-transparent transition-colors">
                          <td className="py-4 px-6 font-bold text-gray-900">{row.name}</td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-700">{row.role}</span>
                              <span className="text-xs text-gray-500">{row.department}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.studentCount} done</span>
                              <span className={`font-extrabold ${row.studentAvg === '-' ? 'text-gray-300' : 'text-[#008c99]'}`}>{row.studentAvg}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.peerCount} done</span>
                              <span className={`font-extrabold ${row.peerAvg === '-' ? 'text-gray-300' : 'text-[#f39c12]'}`}>{row.peerAvg}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.selfCount} done</span>
                              <span className={`font-extrabold ${row.selfAvg === '-' ? 'text-gray-300' : 'text-purple-600'}`}>{row.selfAvg}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-extrabold mt-4 ${obsAvg === '-' ? 'text-gray-300' : 'text-green-600'}`}>{obsAvg}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`font-extrabold text-lg ${row.overallAvg === '-' ? 'text-gray-300' : 'text-[#053b50]'}`}>
                              {row.overallAvg}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {reportData.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No evaluation data found yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OBSERVATION TRACK RECORD */}
      {activeTab === 'observasi' && (
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8 animate-in fade-in duration-300">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Director Report: Instrumen Observasi</h1>
            <p className="text-gray-600 mt-1">Select a teacher below to view their combined Observation Report and Export to PDF.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isObsLoading ? (
               <div className="col-span-full p-8 text-center text-gray-500 font-bold bg-white rounded-2xl border border-gray-200">Loading observation records...</div>
            ) : groupedObservations.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-500 font-bold bg-white rounded-2xl border border-gray-200">No observation records found.</div>
            ) : (
              groupedObservations.map(group => (
                <div key={group.targetId} onClick={() => setSelectedGroupedObs(group)} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-[#008c99] hover:shadow-md transition-all cursor-pointer group hover:-translate-y-1 duration-200 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4 mt-2">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{group.records.length} Record(s)</span>
                    <span className="bg-[#e99a24] text-white text-sm font-extrabold px-3 py-1 rounded-full">{group.averageScore.toFixed(2)}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#008c99] transition-colors">{group.targetName}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">{group.kelas} • {group.subject}</p>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-400">
                    <p className="mb-2">Observed by:</p>
                    <div className="flex flex-wrap gap-2">
                      {group.records.map((r, i) => (
                        <span key={i} className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                          {r.observerName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}