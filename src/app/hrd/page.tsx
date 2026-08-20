'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type User = { id: string; name: string; role: string; gender?: string | null; department?: string; };
type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { id: string; title: string; evaluators: string[]; evaluatees: string[]; sections: Section[] };
type Absence = { id: string; userId: string; userName: string; role: string; attendanceScore: number; };

export default function HRDDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'evaluations' | 'absences'>('absences');
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  
  const [teachers, setTeachers] = useState<User[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedEvals, setCompletedEvals] = useState<Set<string>>(new Set());
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [scores, setScores] = useState<Record<string, 'A'|'B'|'C'|'D'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 ABSENCE STATES (Updated to handle decimals)
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absTargetId, setAbsTargetId] = useState('');
  const [attendanceScore, setAttendanceScore] = useState<number | ''>('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const existing = absences.find(a => a.userId === absTargetId);
    if (existing) {
      setAttendanceScore(existing.attendanceScore);
    } else {
      setAttendanceScore('');
    }
  }, [absTargetId, absences]);

  const fetchData = async () => {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.role !== 'HRD') return router.push('/login');
      setLoggedInUser(meData);
      const compRes = await fetch(`/api/evaluate/completed?graderId=${meData.id}`);
      if (compRes.ok) setCompletedEvals(new Set(await compRes.json())); 
    }
    const tRes = await fetch('/api/director/report');
    if (tRes.ok) setTeachers(await tRes.json());
    const rRes = await fetch('/api/rubric');
    if (rRes.ok) setRubrics(await rRes.json());
    const absRes = await fetch('/api/absences');
    if (absRes.ok) setAbsences(await absRes.json());
  };

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return '';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff'; 
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL' || upper === 'VICE_PRINCIPAL_KURIKULUM' || upper === 'VICE_PRINCIPAL_KESISWAAN') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return dbRole;
  };

  const isSelfReflectionRule = (r: Rubric) => {
    const requiredRoles = ["Teacher", "Staff", "Vice-Principal", "Director/Principal"];
    const excludedRoles = ["Admin", "Student"];
    const hasRequired = requiredRoles.every(role => r.evaluators?.includes(role) && r.evaluatees?.includes(role));
    return hasRequired && !excludedRoles.some(role => r.evaluators?.includes(role) || r.evaluatees?.includes(role));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !loggedInUser) return;
    const scoreArray = Object.entries(scores).map(([indicatorId, value]) => ({ indicatorId, value }));
    if (scoreArray.length === 0) return alert("Please score at least one indicator.");
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graderId: loggedInUser.id, targetId: selectedTarget.id, scores: scoreArray }),
      });
      if (res.ok) {
        alert("Evaluation submitted!");
        setCompletedEvals(prev => new Set(prev).add(selectedTarget.id));
        setSelectedTarget(null); setScores({});
      }
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const submitAbsence = async (e: FormEvent) => {
    e.preventDefault();
    const target = teachers.find(t => t.id === absTargetId);
    if (!target) return alert("Pilih staff!");
    
    // 🚀 VALIDATE THE DECIMAL SCORE
    if (attendanceScore === '' || attendanceScore < 1 || attendanceScore > 4) {
      return alert("Masukkan skor kehadiran yang valid antara 1.0 hingga 4.0!");
    }

    const res = await fetch('/api/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: target.id, 
        userName: target.name, 
        role: target.role, 
        attendanceScore: attendanceScore
      })
    });

    if (res.ok) {
      alert("Skor Kehadiran Berhasil Disimpan!");
      const updatedRecord = await res.json();
      setAbsences(prev => {
        const filtered = prev.filter(p => p.userId !== target.id);
        return [updatedRecord, ...filtered].sort((a, b) => a.userName.localeCompare(b.userName));
      });
      setAbsTargetId(''); 
      setAttendanceScore('');
    } else {
      alert("Gagal menyimpan data.");
    }
  };

  const filteredTeachers = teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) && t.id !== loggedInUser?.id && t.role !== 'STUDENT' && t.role !== 'ADMIN');
  let activeRubric = loggedInUser && selectedTarget ? rubrics.find(r => r.evaluators?.includes('Staff') && r.evaluatees?.includes(getNormalizedRole(selectedTarget.role)) && !isSelfReflectionRule(r)) || null : null;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 border-b border-gray-200 gap-4">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-10 w-auto" priority />
        <div className="flex gap-8 text-[15px] font-bold">
          <button onClick={() => setActiveTab('absences')} className={`pb-1 border-b-2 ${activeTab === 'absences' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>Penilaian Kehadiran</button>
          <button onClick={() => setActiveTab('evaluations')} className={`pb-1 border-b-2 ${activeTab === 'evaluations' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>Peer Evaluations</button>
        </div>
        <Link href="/login" className="text-red-500 font-bold hover:text-red-700">Logout</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-12 space-y-8">
        <h1 className="text-3xl font-extrabold text-[#053b50]">Welcome, HRD {loggedInUser?.name}</h1>

        {activeTab === 'absences' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit">
              <h2 className="text-xl font-bold mb-4">Input Skor Kehadiran</h2>
              <form onSubmit={submitAbsence} className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-gray-700">Pilih Karyawan</label>
                  <select value={absTargetId} onChange={(e) => setAbsTargetId(e.target.value)} required className="w-full mt-2 border border-gray-300 rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-[#008c99]/50">
                    <option value="">-- Pilih Target --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role.replace('_', ' ')})</option>)}
                  </select>
                </div>
                
                {/* 🚀 NEW DECIMAL INPUT INSTEAD OF BUTTONS */}
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">Input Skor (1.0 - 4.0)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="1.0" 
                    max="4.0" 
                    value={attendanceScore} 
                    onChange={(e) => setAttendanceScore(e.target.value === '' ? '' : Number(e.target.value))} 
                    required 
                    className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-[#008c99]/50 font-bold text-lg text-center"
                    placeholder="Contoh: 3.5"
                  />
                </div>
                
                <button type="submit" className="w-full bg-[#053b50] hover:bg-[#032635] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95">
                  Simpan Skor
                </button>
              </form>
            </div>

            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold mb-4">Rekap Skor Kehadiran</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-sm">
                      <th className="p-3 rounded-tl-lg font-bold">Nama</th>
                      <th className="p-3 text-center font-bold">Skor Kehadiran</th>
                      <th className="p-3 text-right rounded-tr-lg font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absences.map(a => (
                      <tr key={a.id} className="border-b border-gray-100 text-sm hover:bg-gray-50">
                        <td className="p-3 font-bold">{a.userName} <span className="text-[10px] text-gray-400 block uppercase">{a.role.replace('_', ' ')}</span></td>
                        {/* 🚀 FORCES IT TO DISPLAY 1 DECIMAL (e.g. 3.0 or 3.5) */}
                        <td className="p-3 text-center font-extrabold text-[#008c99] text-lg">{a.attendanceScore.toFixed(1)} <span className="text-xs text-gray-400 font-normal">/ 4.0</span></td>
                        <td className="p-3 text-right">
                          <button onClick={() => { setAbsTargetId(a.userId); setAttendanceScore(a.attendanceScore); }} className="text-blue-500 font-bold hover:text-blue-700 text-xs bg-blue-50 px-3 py-1.5 rounded-lg">
                            Edit Skor
                          </button>
                        </td>
                      </tr>
                    ))}
                    {absences.length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-gray-500 font-bold">Belum ada skor yang diinput.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EVALUATIONS TAB */}
        {activeTab === 'evaluations' && (
          <div className="space-y-8">
            <Link href="/self-reflection" className="block w-full bg-[#053b50] hover:bg-[#032635] text-white font-bold py-4 rounded-xl shadow-md text-center">Complete HRD Self-Reflection</Link>
            
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
              <div className="px-8 py-5 border-b border-gray-100 bg-gray-50 flex items-center">
                <input type="text" placeholder="Search for a Colleague..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-gray-800 text-xl font-bold bg-transparent" />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filteredTeachers.map(teacher => {
                  const done = completedEvals.has(teacher.id);
                  return (
                    <div key={teacher.id} onClick={() => !done && setSelectedTarget(teacher)} className={`p-4 px-8 flex justify-between border-b ${done ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                      <div><h3 className="font-bold">{teacher.name}</h3><p className="text-xs text-gray-500">{teacher.role.replace('_', ' ')}</p></div>
                      <button disabled={done} className={`px-4 py-2 rounded-lg font-bold text-sm ${done ? 'bg-gray-200 text-gray-500' : 'border-2 border-[#e99a24] text-[#e99a24]'}`}>{done ? 'Completed' : 'Evaluate'}</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedTarget && activeRubric && (
               <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                 <div className="bg-[#008c99] px-8 py-6 text-white flex justify-between items-center">
                   <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {selectedTarget.name}</h2>
                   <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/10 px-4 py-2 rounded-lg">Cancel</button>
                 </div>
                 <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
                    {(activeRubric.sections || []).map((section) => (
                      <div key={section.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gray-100 px-6 py-3 border-b"><h3 className="font-bold">{section.title}</h3></div>
                        <div className="p-6 space-y-8">
                          {(section.categories || []).map((cat) => (
                            <div key={cat.id} className="space-y-4"><h4 className="font-bold text-[#e99a24] text-sm border-b pb-2">{cat.title}</h4>
                              {(cat.indicators || []).map((ind) => (
                                <div key={ind.id} className="flex justify-between items-center gap-4 p-4 rounded-lg bg-gray-50">
                                  <p className="font-medium text-sm w-2/3">{ind.text}</p>
                                  <div className="flex gap-2">
                                    {['A', 'B', 'C', 'D'].map(val => (
                                      <label key={val} className={`flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold ${scores[ind.id] === val ? 'bg-[#008c99] text-white' : 'bg-white text-gray-500'}`}>
                                        <input type="radio" className="hidden" onChange={() => setScores(p => ({...p, [ind.id]: val as any}))} required /> {val}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end"><button type="submit" disabled={isSubmitting} className="bg-[#e99a24] text-white font-extrabold px-10 py-4 rounded-xl shadow-md">{isSubmitting ? 'Saving...' : 'Submit Evaluation'}</button></div>
                 </form>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}