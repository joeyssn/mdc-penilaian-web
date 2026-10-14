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

type GroupedObservation = { targetId: string; targetName: string; kelas: string; subject: string; averageScore: number; records: Observation[]; };
type Absence = { id: string; userId: string; userName: string; role: string; attendanceScore: number; };

const FALLBACK_TEMPLATE = [{ id: 'A', title: 'A. Persiapan Materi', indicators: [{ id: 'A1', text: 'Guru menyiapkan materi' }] }];

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

  const defaultWeights = { studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 };
  const [weightsConfig, setWeightsConfig] = useState<Record<string, typeof defaultWeights>>({
    'Teacher': { ...defaultWeights }, 'Staff': { ...defaultWeights }, 'Karyawan': { ...defaultWeights },
    'Vice-Principal': { ...defaultWeights }, 'Director/Principal': { ...defaultWeights }
  });
  
  const [myWeights, setMyWeights] = useState({ studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 });
  const [myAbsence, setMyAbsence] = useState<number | null>(null);
  const [myObsAvg, setMyObsAvg] = useState<number | null>(null);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [absences, setAbsences] = useState<Absence[]>([]);
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
    let meData: User | null = null;
    if (meRes.ok) {
      meData = await meRes.json();
      setLoggedInUser(meData);
      const compRes = await fetch(`/api/evaluate/completed?graderId=${meData!.id}`);
      if (compRes.ok) setCompletedEvals(new Set(await compRes.json())); 
    }
    const scoreRes = await fetch('/api/me/scores');
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      if (!scoreData.error) setMyScores(scoreData);
    }

    const wRes = await fetch('/api/settings/weights');
    const wData = await wRes.json();
    if (!wData.error && Array.isArray(wData)) {
      const loadedConfig: any = {};
      wData.forEach((w: any) => { loadedConfig[w.id] = w; });
      setWeightsConfig(prev => ({ ...prev, ...loadedConfig }));

      if (meData) {
        const roleMap: Record<string, string> = {
          'TEACHER': 'Teacher', 'STAFF': 'Staff', 'HRD': 'Staff', 'KARYAWAN': 'Karyawan',
          'PRINCIPAL': 'Director/Principal', 'DIRECTOR': 'Director/Principal',
          'VICE_PRINCIPAL': 'Vice-Principal', 'VICE_PRINCIPAL_KURIKULUM': 'Vice-Principal', 'VICE_PRINCIPAL_KESISWAAN': 'Vice-Principal'
        };
        const myW = wData.find((w: any) => w.id === (roleMap[meData!.role.toUpperCase()] || 'Staff'));
        if (myW) setMyWeights({ studentWeight: Number(myW.studentWeight), peerWeight: Number(myW.peerWeight), observationWeight: Number(myW.observationWeight), attendanceWeight: Number(myW.attendanceWeight) });
      }
    }

    const tRes = await fetch('/api/teachers');
    const tData = await tRes.json();
    if (!tData.error) setTeachers(tData);

    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    if (!rData.error && rData.length > 0) setRubrics(rData);
  };

  const fetchOverviewData = async () => {
    try {
      const res = await fetch('/api/director/report');
      const data = await res.json();
      if (!data.error) setReportData(data);
      const absRes = await fetch('/api/absences');
      const absData = await absRes.json();
      if (!absData.error) setAbsences(absData);
    } catch (error) {} finally { setIsReportLoading(false); }
  };

  const fetchObservations = async () => {
    try {
      try {
        const tplRes = await fetch('/api/observasi/template');
        if (tplRes.ok) setObservationTemplate(await tplRes.json());
      } catch (e) { setObservationTemplate(FALLBACK_TEMPLATE); }

      const res = await fetch('/api/observasi');
      const data = await res.json();
      if (!data.error) {
        const approvedData = data.filter((obs: Observation) => obs.isApproved === true);
        if (loggedInUser) {
          const myObs = approvedData.filter((o: any) => o.targetId === loggedInUser.id);
          if (myObs.length > 0) setMyObsAvg(myObs.reduce((s: number, o: any) => s + o.finalScore, 0) / myObs.length);
        }
        const grouped = approvedData.reduce((acc: any, obs: Observation) => {
          if (!acc[obs.targetId]) acc[obs.targetId] = { targetId: obs.targetId, targetName: obs.targetName, kelas: obs.kelas, subject: obs.subject, records: [] };
          acc[obs.targetId].records.push(obs);
          return acc;
        }, {});
        const groupedArray: GroupedObservation[] = Object.values(grouped).map((g: any) => ({ ...g, averageScore: g.records.reduce((sum: number, r: Observation) => sum + r.finalScore, 0) / g.records.length }));
        setGroupedObservations(groupedArray);
      }
    } catch (error) {} finally { setIsObsLoading(false); }
  };

  const getTitle = (gender?: string | null) => gender === 'Laki-Laki' ? 'Mr. ' : gender === 'Perempuan' ? "Ma'am " : '';

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return 'Staff';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff';
    if (upper === 'KARYAWAN') return 'Karyawan'; 
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper.includes('VICE_PRINCIPAL') || upper === 'VICE-PRINCIPAL') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return 'Staff';
  };

  const handleScoreChange = (indicatorId: string, value: 'A'|'B'|'C'|'D') => setScores(prev => ({ ...prev, [indicatorId]: value }));

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

  const filteredTeachers = teachers.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch || !loggedInUser || target.id === loggedInUser.id) return false;
    return target.role.toUpperCase() === 'PRINCIPAL';
  });

  let activeRubric: Rubric | null = null;
  if (loggedInUser && selectedTarget) {
    const myRole = getNormalizedRole(loggedInUser.role);
    const targetRole = getNormalizedRole(selectedTarget.role);

    activeRubric = rubrics.find(r => 
      r.evaluators?.includes(myRole) && 
      r.evaluatees?.includes(targetRole) &&
      !r.title.toLowerCase().includes('self') 
    ) || null;
  }

  let activeWeightSum = 0; let accumulatedScore = 0;
  const sScore = myScores?.student?.average || 0;
  const pScore = myScores?.peer?.average || 0;
  const oScore = myObsAvg || 0;
  const aScore = myAbsence || 0;

  if (myWeights.studentWeight > 0 && sScore > 0) { activeWeightSum += myWeights.studentWeight; accumulatedScore += (sScore * myWeights.studentWeight); }
  if (myWeights.peerWeight > 0 && pScore > 0) { activeWeightSum += myWeights.peerWeight; accumulatedScore += (pScore * myWeights.peerWeight); }
  if (myWeights.observationWeight > 0 && oScore > 0) { activeWeightSum += myWeights.observationWeight; accumulatedScore += (oScore * myWeights.observationWeight); }
  if (myWeights.attendanceWeight > 0 && aScore > 0) { activeWeightSum += myWeights.attendanceWeight; accumulatedScore += (aScore * myWeights.attendanceWeight); }

  const trueOverallAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-.-';

  if (activeTab === 'observasi' && selectedGroupedObs) {
    return (
      <div className="min-h-screen bg-gray-200 py-10 print:bg-white print:py-0 font-serif">
        <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-md">
          <button onClick={() => setSelectedGroupedObs(null)} className="text-gray-600 font-bold bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200">← Back to List</button>
          <button onClick={() => window.print()} className="bg-[#053b50] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#032635] flex items-center gap-2">Export to PDF</button>
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
                <h3 className="font-bold text-lg">Supervisor {index + 1}: {rec.observerName} <span className="text-gray-500 text-sm font-normal">({rec.date})</span></h3>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#e99a24] text-base">Skor Asli: {rec.finalScore.toFixed(2)}</span>
                  <span className="bg-green-100 text-green-700 border border-green-300 px-3 py-1 rounded text-sm font-bold flex items-center gap-1">Approved</span>
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
                        <tr className="bg-gray-50 print:bg-gray-100"><td colSpan={2} className="border border-gray-300 px-3 py-2 font-bold text-gray-800">{cat.title}</td></tr>
                        {cat.indicators.map((ind: any) => (
                          <tr key={ind.id}>
                            <td className="border border-gray-300 px-3 py-2 pl-6 text-gray-700">{ind.text}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-base">{rec.scores?.[ind.id] !== undefined ? rec.scores[ind.id] : '-'}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
          <button onClick={() => setActiveTab('personal')} className={`pb-1 transition-all border-b-2 ${activeTab === 'personal' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>My Evaluation</button>
          <button onClick={() => setActiveTab('overview')} className={`pb-1 transition-all border-b-2 ${activeTab === 'overview' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>School Overview</button>
          <button onClick={() => setActiveTab('observasi')} className={`pb-1 transition-all border-b-2 ${activeTab === 'observasi' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>Observation Track Record</button>
        </div>
        <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
      </nav>

      {activeTab === 'personal' && (
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 space-y-12 animate-in fade-in duration-300">
          <div>
            {loggedInUser && <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50] mb-6 md:mb-8 text-center md:text-left">Hi, Welcome {getTitle(loggedInUser.gender)}{loggedInUser.name}</h1>}

            {myScores && (
              <>
                <div className="bg-[#053b50] rounded-2xl px-6 py-6 md:px-8 md:py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-md border border-gray-800">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-wide">Final Evaluation Rating</h2>
                    <p className="text-sm font-medium opacity-90 mt-1 text-gray-300">Your overall score based on the metrics below</p>
                  </div>
                  <div className="text-center md:text-right">
                    <div className="text-5xl md:text-5xl font-extrabold tracking-tight text-[#e99a24]">{trueOverallAvg}</div>
                    <div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {myWeights.studentWeight > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-black">Student Rating</h3>
                        <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.studentWeight}%</p>
                        <div className="flex justify-between items-end mb-3">
                          <div className="text-3xl font-extrabold text-[#008c99] tracking-tight">{sScore > 0 ? sScore.toFixed(1) : '-.-'}</div>
                        </div>
                      </div>
                      <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-[#008c99] h-3 rounded-full transition-all duration-1000" style={{ width: `${(sScore / 4) * 100}%` }}></div></div>
                    </div>
                  )}
                  {myWeights.peerWeight > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-black">Scores from Others</h3>
                        <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.peerWeight}%</p>
                        <div className="flex justify-between items-end mb-3">
                          <div className="text-3xl font-extrabold text-[#f39c12] tracking-tight">{pScore > 0 ? pScore.toFixed(1) : '-.-'}</div>
                        </div>
                      </div>
                      <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-[#f39c12] h-3 rounded-full transition-all duration-1000" style={{ width: `${(pScore / 4) * 100}%` }}></div></div>
                    </div>
                  )}
                  {myWeights.observationWeight > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-black">Observation</h3>
                        <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.observationWeight}%</p>
                        <div className="flex justify-between items-end mb-3">
                          <div className="text-3xl font-extrabold text-green-600 tracking-tight">{oScore > 0 ? oScore.toFixed(2) : '-.-'}</div>
                        </div>
                      </div>
                      <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-green-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(oScore / 4) * 100}%` }}></div></div>
                    </div>
                  )}
                  {myWeights.attendanceWeight > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-black">Attendance</h3>
                        <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.attendanceWeight}%</p>
                        <div className="flex justify-between items-end mb-3">
                          <div className="text-3xl font-extrabold text-teal-600 tracking-tight">{aScore > 0 ? aScore.toFixed(1) : '-.-'}</div>
                        </div>
                      </div>
                      <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-teal-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(aScore / 4) * 100}%` }}></div></div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <Link href="/self-reflection" className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md text-center transition-all">Complete My Self-Reflection</Link>
                </div>
              </>
            )}
          </div>

          <div className="pt-10 border-t border-gray-200">
            <div><h2 className="text-3xl font-extrabold text-[#053b50]">Peer Evaluation Portal</h2><p className="text-gray-500 mt-2 text-lg">Select a Principal below to begin scoring.</p></div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mt-6">
              <div className="flex items-center px-8 py-5 border-b border-gray-100 bg-gray-50">
                <svg className="w-6 h-6 text-gray-400 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-gray-800 text-xl font-bold bg-transparent" autoComplete="off" suppressHydrationWarning />
              </div>

              {searchQuery && (
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredTeachers.map(teacher => {
                    const hasEvaluated = completedEvals.has(teacher.id);
                    return (
                      <div key={teacher.id} onClick={() => !hasEvaluated && setSelectedTarget(teacher)} className={`p-4 px-8 flex items-center justify-between border-b border-gray-100 ${hasEvaluated ? 'opacity-60 bg-gray-50' : 'hover:bg-[#008c99]/5 cursor-pointer'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${hasEvaluated ? 'bg-gray-200 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>{teacher.name.charAt(0)}</div>
                          <div>
                            <h3 className="font-bold text-lg">{getTitle(teacher.gender)}{teacher.name}</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{teacher.role}</p>
                          </div>
                        </div>
                        {hasEvaluated ? (
                          <button disabled className="bg-gray-100 text-gray-400 border-2 border-gray-200 px-4 py-2 rounded-lg font-bold text-sm">Completed</button>
                        ) : (
                          <button className="bg-white border-2 border-[#e99a24] text-[#e99a24] px-4 py-2 rounded-lg font-bold text-sm">Evaluate</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedTarget && activeRubric && (
              <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="bg-[#008c99] px-8 py-6 text-white flex justify-between items-center">
                  <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                  <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="bg-black/10 px-4 py-2 rounded-lg font-bold">Cancel</button>
                </div>
                <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
                  {(activeRubric.sections || []).map((section) => (
                    <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-100 px-6 py-3 border-b"><h3 className="font-bold text-gray-800 text-lg">{section.title}</h3></div>
                      <div className="p-6 space-y-8">
                        {(section.categories || []).map((category) => (
                          <div key={category.id} className="space-y-4">
                            <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm border-b pb-2">{category.title}</h4>
                            <div className="space-y-4">
                              {(category.indicators || []).map((indicator) => (
                                <div key={indicator.id} className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gray-50">
                                  <p className="text-gray-700 font-medium md:w-2/3">{indicator.text}</p>
                                  <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200">
                                    {['A', 'B', 'C', 'D'].map((val) => (
                                      <label key={val} className={`flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}>
                                        <input type="radio" name={indicator.id} value={val} className="hidden" onChange={() => handleScoreChange(indicator.id, val as 'A'|'B'|'C'|'D')} required /> {val}
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
                  <div className="flex justify-end pt-6 border-t"><button type="submit" disabled={isSubmitting} className="bg-[#e99a24] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md">{isSubmitting ? 'Saving...' : 'Submit Evaluation'}</button></div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SCHOOL OVERVIEW DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8 animate-in fade-in duration-300 print:p-0 print:pt-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-extrabold text-[#053b50]">School-Wide Overview</h1>
              <p className="text-gray-500 mt-2 font-medium print:hidden">Monitor evaluation performance across the entire staff.</p>
            </div>
            <button onClick={() => window.print()} className="bg-[#008c99] text-white font-bold py-3 px-6 rounded-xl shadow-md print:hidden">Print Data</button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none mt-6">
            {isReportLoading ? (
              <div className="p-12 text-center text-gray-500 font-bold">Generating Report...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                      <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs">Staff Name</th>
                      <th className="py-4 px-4 font-bold text-[#008c99] uppercase text-xs text-center">Student Score</th>
                      <th className="py-4 px-4 font-bold text-[#f39c12] uppercase text-xs text-center">Peer Score</th>
                      <th className="py-4 px-4 font-bold text-green-600 uppercase text-xs text-center">Observation</th>
                      <th className="py-4 px-4 font-bold text-teal-600 uppercase text-xs text-center">Attendance</th>
                      <th className="py-4 px-6 font-extrabold text-white bg-[#053b50] uppercase text-xs text-center print:bg-transparent print:text-black">Final Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* 🚀 HIDDEN ADMINS AND STUDENTS */}
                    {reportData
                      .filter((row) => row.role.toUpperCase() !== 'STUDENT' && row.role.toUpperCase() !== 'ADMIN')
                      .map((row) => {
                      const sScore = parseFloat(row.studentAvg);
                      const pScore = parseFloat(row.peerAvg);
                      const obsGroup = groupedObservations.find(g => g.targetId === row.id);
                      const oScore = obsGroup ? obsGroup.averageScore : NaN;
                      const userAbsence = absences.find(a => a.userId === row.id);
                      const aScore = userAbsence ? userAbsence.attendanceScore : NaN;

                      const roleKey = getNormalizedRole(row.role);
                       const activeWeights = weightsConfig[roleKey] || defaultWeights;

                      let wStudent = activeWeights.studentWeight; let wPeer = activeWeights.peerWeight; 
                      let wObs = activeWeights.observationWeight; let wAtt = activeWeights.attendanceWeight;

                      let activeWeightSum = 0; let accumulatedScore = 0;
                      if (!isNaN(sScore)) { activeWeightSum += wStudent; accumulatedScore += (sScore * wStudent); }
                      if (!isNaN(pScore)) { activeWeightSum += wPeer; accumulatedScore += (pScore * wPeer); }
                      if (!isNaN(oScore)) { activeWeightSum += wObs; accumulatedScore += (oScore * wObs); }
                      if (!isNaN(aScore)) { activeWeightSum += wAtt; accumulatedScore += (aScore * wAtt); }

                      const finalDynamicAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-';

                      return (
                        <tr key={row.id} className="hover:bg-gray-50 print:hover:bg-transparent transition-colors">
                          <td className="py-4 px-6 font-bold text-gray-900">{row.name}<br/><span className="text-[10px] text-gray-500 uppercase tracking-widest">{row.role.replace('_', ' ')}</span></td>
                          <td className="py-4 px-4 text-center font-extrabold text-[#008c99]">{row.studentAvg}</td>
                          <td className="py-4 px-4 text-center font-extrabold text-[#f39c12]">{row.peerAvg}</td>
                          <td className="py-4 px-4 text-center font-extrabold text-green-600">{obsGroup ? obsGroup.averageScore.toFixed(2) : '-'}</td>
                          <td className="py-4 px-4 text-center font-extrabold text-teal-600">{userAbsence ? userAbsence.attendanceScore.toFixed(1) : '-'}</td>
                          <td className="py-4 px-6 text-center bg-blue-50/30 print:bg-transparent font-extrabold text-xl text-[#053b50]">{finalDynamicAvg}</td>
                        </tr>
                      );
                    })}
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
              <div className="col-span-full p-8 text-center text-gray-500 font-bold bg-white rounded-2xl border border-gray-200">No approved observation records found.</div>
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
  )
}