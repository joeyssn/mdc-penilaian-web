'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// --- TYPES ---
type ReportRow = { id: string; name: string; role: string; department: string; studentCount: number; peerCount: number; selfCount: number; studentAvg: string; peerAvg: string; selfAvg: string; overallAvg: string; };
type Observation = { id: string; targetId: string; targetName: string; finalScore: number; isApproved: boolean; };
type GroupedObservation = { targetId: string; averageScore: number; records: Observation[]; };
type Absence = { id: string; userId: string; userName: string; attendanceScore: number; };

export default function AdminSettingsOverviewPage() {
  const [weights, setWeights] = useState({ studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 });
  const [isSaving, setIsSaving] = useState(false);

  // Data States for the Live Table
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [groupedObservations, setGroupedObservations] = useState<GroupedObservation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Current Saved Weights
      const wRes = await fetch('/api/settings/weights');
      const wData = await wRes.json();
      if (!wData.error) setWeights({ studentWeight: wData.studentWeight, peerWeight: wData.peerWeight, observationWeight: wData.observationWeight, attendanceWeight: wData.attendanceWeight });

      // 2. Fetch Base Evaluation Report (Student, Peer, Self)
      const rRes = await fetch('/api/director/report');
      const rData = await rRes.json();
      if (!rData.error) setReportData(rData);

      // 3. Fetch Approved Observations
      const obsRes = await fetch('/api/observasi');
      const obsData = await obsRes.json();
      if (!obsData.error) {
        const approvedData = obsData.filter((obs: Observation) => obs.isApproved === true);
        const grouped = approvedData.reduce((acc: any, obs: Observation) => {
          if (!acc[obs.targetId]) acc[obs.targetId] = { targetId: obs.targetId, records: [] };
          acc[obs.targetId].records.push(obs);
          return acc;
        }, {});

        const groupedArray: GroupedObservation[] = Object.values(grouped).map((g: any) => ({
          ...g,
          averageScore: g.records.reduce((sum: number, r: Observation) => sum + r.finalScore, 0) / g.records.length
        }));
        setGroupedObservations(groupedArray);
      }

      // 4. Fetch Attendance Scores from HRD
      const absRes = await fetch('/api/absences');
      const absData = await absRes.json();
      if (!absData.error) setAbsences(absData);

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const total = weights.studentWeight + weights.peerWeight + weights.observationWeight + weights.attendanceWeight;

  const handleSave = async () => {
    if (total !== 100) return alert("Total percentage must equal exactly 100%!");
    setIsSaving(true);
    const res = await fetch('/api/settings/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights)
    });
    if (res.ok) alert("Scoring Weights Updated! The Director's Report is now using these new percentages.");
    setIsSaving(false);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading Live Overview...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-10 w-auto" priority />
        <Link href="/admin" className="text-gray-600 font-bold hover:text-black">Back to Admin Dashboard</Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-12 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Admin Overview & Scoring Weights</h1>
            <p className="text-gray-600 mt-1">Adjust the sliders below to see how it affects everyone's final score in real-time.</p>
          </div>
          <button onClick={handleSave} disabled={total !== 100 || isSaving} className="bg-[#053b50] hover:bg-[#032635] text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save & Apply Percentages'}
          </button>
        </div>

        {/* INTERACTIVE SLIDERS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="font-bold text-gray-700 flex justify-between">Student Evaluation Impact <span className="text-[#008c99]">{weights.studentWeight}%</span></label>
              <input type="range" min="0" max="100" value={weights.studentWeight} onChange={(e) => setWeights({ ...weights, studentWeight: Number(e.target.value) })} className="w-full accent-[#008c99]" />
            </div>
            <div className="space-y-2">
              <label className="font-bold text-gray-700 flex justify-between">Peer Evaluation Impact <span className="text-[#f39c12]">{weights.peerWeight}%</span></label>
              <input type="range" min="0" max="100" value={weights.peerWeight} onChange={(e) => setWeights({ ...weights, peerWeight: Number(e.target.value) })} className="w-full accent-[#f39c12]" />
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="font-bold text-gray-700 flex justify-between">Observation Impact (Principal/VP) <span className="text-green-600">{weights.observationWeight}%</span></label>
              <input type="range" min="0" max="100" value={weights.observationWeight} onChange={(e) => setWeights({ ...weights, observationWeight: Number(e.target.value) })} className="w-full accent-green-600" />
            </div>
            <div className="space-y-2">
              <label className="font-bold text-gray-700 flex justify-between">Attendance Impact (HRD) <span className="text-teal-600">{weights.attendanceWeight}%</span></label>
              <input type="range" min="0" max="100" value={weights.attendanceWeight} onChange={(e) => setWeights({ ...weights, attendanceWeight: Number(e.target.value) })} className="w-full accent-teal-600" />
            </div>
          </div>

          <div className={`md:col-span-2 p-4 rounded-xl font-bold text-center text-lg transition-colors ${total === 100 ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
            Current Total: {total}% {total !== 100 && "(Adjust sliders so total equals exactly 100%)"}
          </div>
        </div>

        {/* LIVE SIMULATION TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Live Preview: Director's Master Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Staff Name</th>
                  <th className="py-4 px-4 font-bold text-[#008c99] uppercase text-xs tracking-wider text-center">Student<br/><span className="text-[10px] text-gray-400 font-normal">Score</span></th>
                  <th className="py-4 px-4 font-bold text-[#f39c12] uppercase text-xs tracking-wider text-center">Peer<br/><span className="text-[10px] text-gray-400 font-normal">Score</span></th>
                  <th className="py-4 px-4 font-bold text-green-600 uppercase text-xs tracking-wider text-center">Observation<br/><span className="text-[10px] text-gray-400 font-normal">Avg Score</span></th>
                  <th className="py-4 px-4 font-bold text-teal-600 uppercase text-xs tracking-wider text-center">Attendance<br/><span className="text-[10px] text-gray-400 font-normal">HRD Score</span></th>
                  <th className="py-4 px-6 font-extrabold text-[#053b50] bg-blue-50 uppercase text-xs tracking-wider text-center border-l border-blue-100">Simulated Final Average<br/><span className="text-[10px] text-gray-500 font-normal">(Scale 1-4)</span></th>
                </tr>
              </thead>
              
              {/* 🚀 LIVE DYNAMIC MATH ENGINE */}
              <tbody className="divide-y divide-gray-100">
                {reportData.map((row) => {
                  const sScore = parseFloat(row.studentAvg);
                  const pScore = parseFloat(row.peerAvg);
                  
                  const obsGroup = groupedObservations.find(g => g.targetId === row.id);
                  const oScore = obsGroup ? obsGroup.averageScore : NaN;
                  const obsAvgDisplay = obsGroup ? obsGroup.averageScore.toFixed(2) : '-';

                  const userAbsence = absences.find(a => a.userId === row.id);
                  const aScore = userAbsence ? userAbsence.attendanceScore : NaN;
                  const attAvgDisplay = userAbsence ? userAbsence.attendanceScore.toFixed(1) : '-';

                  // Apply Live Slider Weights
                  let wStudent = weights.studentWeight; 
                  let wPeer = weights.peerWeight; 
                  let wObs = weights.observationWeight;
                  let wAtt = weights.attendanceWeight;

                  let activeWeightSum = 0;
                  let accumulatedScore = 0;

                  // Distribute weights dynamically based on available scores
                  if (!isNaN(sScore)) { activeWeightSum += wStudent; accumulatedScore += (sScore * wStudent); }
                  if (!isNaN(pScore)) { activeWeightSum += wPeer; accumulatedScore += (pScore * wPeer); }
                  if (!isNaN(oScore)) { activeWeightSum += wObs; accumulatedScore += (oScore * wObs); }
                  if (!isNaN(aScore)) { activeWeightSum += wAtt; accumulatedScore += (aScore * wAtt); }

                  const finalDynamicAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-';

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-bold text-gray-900 block">{row.name}</span>
                        <span className="text-xs text-gray-500 font-medium">{row.role.replace('_', ' ')}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-[#008c99]">{row.studentAvg !== '-' ? row.studentAvg : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-[#f39c12]">{row.peerAvg !== '-' ? row.peerAvg : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-green-600">{obsAvgDisplay !== '-' ? obsAvgDisplay : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-teal-600">{attAvgDisplay !== '-' ? attAvgDisplay : <span className="text-gray-300">-</span>}</td>
                      
                      {/* THIS COLUMN UPDATES INSTANTLY WHEN SLIDERS MOVE */}
                      <td className="py-4 px-6 text-center bg-blue-50/50 border-l border-blue-100">
                        <span className={`font-extrabold text-xl ${finalDynamicAvg === '-' ? 'text-gray-300' : 'text-[#053b50]'}`}>
                          {finalDynamicAvg}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {reportData.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500 font-bold">Belum ada data evaluasi di database.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}