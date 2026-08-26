'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ReportRow = { id: string; name: string; role: string; department: string; studentCount: number; peerCount: number; selfCount: number; studentAvg: string; peerAvg: string; selfAvg: string; overallAvg: string; };
type Observation = { id: string; targetId: string; targetName: string; finalScore: number; isApproved: boolean; };
type GroupedObservation = { targetId: string; averageScore: number; records: Observation[]; };
type Absence = { id: string; userId: string; userName: string; attendanceScore: number; };

type ChartData = { name: string; value: number; fill: string };
type Totals = { totalStudents: number; activeStudents: number; totalTeachersStaff: number; activeTeachersStaff: number; overallTotal: number; overallActive: number; };

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview'>('overview');

  // 🚀 ADDED KARYAWAN TO THE STATE
  const defaultWeights = { studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 };
  const [weightsConfig, setWeightsConfig] = useState<Record<string, typeof defaultWeights>>({
    'Teacher': { ...defaultWeights },
    'Staff': { ...defaultWeights },
    'Karyawan': { ...defaultWeights }, // 🚀 NEW
    'Vice-Principal': { ...defaultWeights },
    'Director/Principal': { ...defaultWeights }
  });
  const [selectedRoleWeight, setSelectedRoleWeight] = useState('Teacher');
  const [isSaving, setIsSaving] = useState(false);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [groupedObservations, setGroupedObservations] = useState<GroupedObservation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [studentData, setStudentData] = useState<ChartData[]>([]);
  const [teacherData, setTeacherData] = useState<ChartData[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (!statsData.error) {
          setStudentData(statsData.studentStats);
          setTeacherData(statsData.teacherStats);
          setTotals(statsData.totals);
        }
      }

      const wRes = await fetch('/api/settings/weights');
      const wData = await wRes.json();
      if (!wData.error && Array.isArray(wData)) {
        const loadedConfig: any = {};
        // 🚀 ADDED KARYAWAN TO VALID ROLES
        const validRoles = ['Teacher', 'Staff', 'Karyawan', 'Vice-Principal', 'Director/Principal']; 
        
        wData.forEach((w: any) => { 
          if (validRoles.includes(w.id)) {
            loadedConfig[w.id] = {
              studentWeight: Number(w.studentWeight) || 0,
              peerWeight: Number(w.peerWeight) || 0,
              observationWeight: Number(w.observationWeight) || 0,
              attendanceWeight: Number(w.attendanceWeight) || 0
            };
          }
        });
        setWeightsConfig(prev => ({ ...prev, ...loadedConfig }));
      }

      const rRes = await fetch('/api/director/report');
      const rData = await rRes.json();
      if (!rData.error) setReportData(rData);

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
          ...g, averageScore: g.records.reduce((sum: number, r: Observation) => sum + r.finalScore, 0) / g.records.length
        }));
        setGroupedObservations(groupedArray);
      }

      const absRes = await fetch('/api/absences');
      const absData = await absRes.json();
      if (!absData.error) setAbsences(absData);

    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const currentW = weightsConfig[selectedRoleWeight];
  const currentTotal = currentW.studentWeight + currentW.peerWeight + currentW.observationWeight + currentW.attendanceWeight;

  const updateWeight = (field: string, value: number) => {
    setWeightsConfig(prev => ({ ...prev, [selectedRoleWeight]: { ...prev[selectedRoleWeight], [field]: value } }));
  };

  const handleSaveWeights = async () => {
    const validRoles = ['Teacher', 'Staff', 'Karyawan', 'Vice-Principal', 'Director/Principal'];

    const invalidRoles = Object.entries(weightsConfig)
      .filter(([role]) => validRoles.includes(role)) 
      .filter(([role, w]) => (w.studentWeight + w.peerWeight + w.observationWeight + w.attendanceWeight) !== 100);

    if (invalidRoles.length > 0) {
      const names = invalidRoles.map(i => i[0]).join(', ');
      return alert(`Error: The total percentage for ${names} is not exactly 100%! Please fix before saving.`);
    }

    setIsSaving(true);
    
    const payload = Object.entries(weightsConfig)
      .filter(([id]) => validRoles.includes(id))
      .map(([id, w]) => ({ id, ...w }));
    
    const res = await fetch('/api/settings/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) alert("Role-Based Scoring Weights Updated! The Director's Report is now locked into these new percentages.");
    setIsSaving(false);
  };

  // 🚀 SEPARATED KARYAWAN FROM STAFF
  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return 'Staff';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff';
    if (upper === 'KARYAWAN') return 'Karyawan'; // 🚀 SEPARATE ROLE
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL' || upper === 'VICE_PRINCIPAL_KURIKULUM' || upper === 'VICE_PRINCIPAL_KESISWAAN') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return 'Staff';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
          <p className="font-bold text-gray-800">{payload[0].name}</p>
          <p className="text-gray-600">{payload[0].value} Users</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading Admin Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans print:bg-white pb-20 print:pb-0">
      
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 print:hidden gap-4">
        <div className="flex items-center">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex gap-8 text-[15px] font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button onClick={() => setActiveTab('overview')} className={`pb-1 transition-all border-b-2 ${activeTab === 'overview' ? 'text-[#053b50] border-[#008c99]' : 'text-gray-500 border-transparent hover:text-[#008c99]'}`}>
            Live Overview & Weights
          </button>
          <Link href="/admin/users" className="pb-1 text-gray-500 border-transparent hover:text-[#008c99] transition-all">Manage Users</Link>
          <Link href="/admin/rubric" className="pb-1 text-gray-500 border-transparent hover:text-[#008c99] transition-all">Manage Rubrics</Link>
          <Link href="/admin/observasi" className="pb-1 text-gray-500 border-transparent hover:text-[#008c99] transition-all">Track Record</Link>
        </div>

        <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
      </nav>

      {activeTab === 'overview' && (
        <div className="max-w-7xl mx-auto px-6 pt-10 space-y-12 print:pt-0">
          
          <div className="hidden print:block text-center border-b-4 border-double border-black pb-4 mb-8 mt-8">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Evaluasi Kinerja (Admin Overview)</h1>
            <h2 className="text-xl font-bold mt-1">SMA Kristen Masa Depan Cerah</h2>
          </div>

          <div className="print:hidden space-y-8">
            <div>
              <h1 className="text-4xl font-extrabold text-[#053b50]">Admin Overview</h1>
              <p className="text-gray-500 mt-2 font-medium">Track evaluation completion rates across the school.</p>
            </div>

            {totals && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Overall Completion</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#053b50]">{totals.overallActive}</span>
                    <span className="text-xl font-bold text-gray-400 mb-1">/ {totals.overallTotal}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">Total users who submitted evaluations</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#008c99]/20 bg-[#008c99]/5 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-[#008c99] uppercase tracking-wider mb-2">Student Submissions</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#008c99]">{totals.activeStudents}</span>
                    <span className="text-xl font-bold text-[#008c99]/50 mb-1">/ {totals.totalStudents}</span>
                  </div>
                  <p className="text-sm text-[#008c99]/70 mt-2 font-medium">Total students participating</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#d49a37]/20 bg-[#d49a37]/5 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-[#d49a37] uppercase tracking-wider mb-2">Teacher & Staff Submissions</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#d49a37]">{totals.activeTeachersStaff}</span>
                    <span className="text-xl font-bold text-[#d49a37]/50 mb-1">/ {totals.totalTeachersStaff}</span>
                  </div>
                  <p className="text-sm text-[#d49a37]/70 mt-2 font-medium">Total staff participating</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Student Breakdown</h2>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={studentData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" animationBegin={0} animationDuration={1500}>
                        {studentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Teacher & Staff Breakdown</h2>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={teacherData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" animationBegin={200} animationDuration={1500}>
                        {teacherData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 print:hidden" />

          <div className="print:hidden">
            <h2 className="text-2xl font-extrabold text-[#053b50] mb-6">Admin Tools & Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <Link href="/admin/users" className="bg-white hover:bg-blue-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
                <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[#053b50] group-hover:text-blue-700">Manage Users</h3>
              </Link>

              <Link href="/admin/rubric" className="bg-white hover:bg-purple-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
                <div className="bg-purple-100 text-purple-600 p-4 rounded-full mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[#053b50] group-hover:text-purple-700">Manage Rubrics</h3>
              </Link>

              <Link href="/admin/observasi" className="bg-white hover:bg-orange-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
                <div className="bg-orange-100 text-orange-600 p-4 rounded-full mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[#053b50] group-hover:text-orange-700">Track Record</h3>
              </Link>

              <Link href="/admin/observasi-template" className="bg-white hover:bg-green-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
                <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[#053b50] group-hover:text-green-700">Edit Template</h3>
              </Link>
            </div>
          </div>

          <hr className="border-gray-300 print:hidden" />

          <div className="print:hidden">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#053b50]">Director's Master Report Simulator</h2>
                <p className="text-gray-600 mt-1">Select a role and adjust the sliders to configure their specific percentage breakdown.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Report
                </button>
                <button onClick={handleSaveWeights} disabled={currentTotal !== 100 || isSaving} className="bg-[#e99a24] hover:bg-[#d68a1f] text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 whitespace-nowrap">
                  {isSaving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="mb-8">
                <label className="font-bold text-gray-700 mr-4">Configure Weights For:</label>
                <select 
                  value={selectedRoleWeight} 
                  onChange={(e) => setSelectedRoleWeight(e.target.value)}
                  className="border-2 border-[#008c99] text-[#053b50] font-bold rounded-xl px-4 py-2 bg-blue-50 outline-none w-full md:w-auto"
                >
                  <option value="Teacher">Target: Teachers</option>
                  <option value="Staff">Target: Staff & HRD</option>
                  {/* 🚀 NEW OPTION FOR KARYAWAN */}
                  <option value="Karyawan">Target: Karyawan</option> 
                  <option value="Vice-Principal">Target: Vice-Principals</option>
                  <option value="Director/Principal">Target: Director/Principal</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="font-bold text-gray-700 flex justify-between">Student Evaluation <span className="text-[#008c99]">{currentW.studentWeight}%</span></label>
                    <input type="range" min="0" max="100" value={currentW.studentWeight} onChange={(e) => updateWeight('studentWeight', Number(e.target.value))} className="w-full accent-[#008c99]" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-bold text-gray-700 flex justify-between">Peer Evaluation <span className="text-[#f39c12]">{currentW.peerWeight}%</span></label>
                    <input type="range" min="0" max="100" value={currentW.peerWeight} onChange={(e) => updateWeight('peerWeight', Number(e.target.value))} className="w-full accent-[#f39c12]" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="font-bold text-gray-700 flex justify-between">Principal / VP Observation <span className="text-green-600">{currentW.observationWeight}%</span></label>
                    <input type="range" min="0" max="100" value={currentW.observationWeight} onChange={(e) => updateWeight('observationWeight', Number(e.target.value))} className="w-full accent-green-600" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-bold text-gray-700 flex justify-between">HRD Attendance <span className="text-teal-600">{currentW.attendanceWeight}%</span></label>
                    <input type="range" min="0" max="100" value={currentW.attendanceWeight} onChange={(e) => updateWeight('attendanceWeight', Number(e.target.value))} className="w-full accent-teal-600" />
                  </div>
                </div>

                <div className={`md:col-span-2 p-4 rounded-xl font-bold text-center text-lg transition-colors ${currentTotal === 100 ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                  Total Weight for {selectedRoleWeight}s: {currentTotal}% {currentTotal !== 100 && "(Adjust sliders so total equals exactly 100%)"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none mt-8">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 print:hidden">
              <h3 className="font-bold text-gray-800">Live Preview Table</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-200 print:bg-gray-100">
                    <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Staff Name</th>
                    <th className="py-4 px-4 font-bold text-[#008c99] uppercase text-xs tracking-wider text-center">Student<br/><span className="text-[10px] text-gray-400 font-normal">Score</span></th>
                    <th className="py-4 px-4 font-bold text-[#f39c12] uppercase text-xs tracking-wider text-center">Peer<br/><span className="text-[10px] text-gray-400 font-normal">Score</span></th>
                    <th className="py-4 px-4 font-bold text-green-600 uppercase text-xs tracking-wider text-center">Observation<br/><span className="text-[10px] text-gray-400 font-normal">Avg Score</span></th>
                    <th className="py-4 px-4 font-bold text-teal-600 uppercase text-xs tracking-wider text-center">Attendance<br/><span className="text-[10px] text-gray-400 font-normal">HRD Score</span></th>
                    <th className="py-4 px-6 font-extrabold text-[#053b50] bg-blue-50 uppercase text-xs tracking-wider text-center border-l border-blue-100 print:bg-transparent print:border-l-0">Simulated Final Average<br/><span className="text-[10px] text-gray-500 font-normal">(Scale 1-4)</span></th>
                  </tr>
                </thead>
                
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

                    const roleKey = getNormalizedRole(row.role);
                    const activeWeights = weightsConfig[roleKey] || defaultWeights;

                    let wStudent = activeWeights.studentWeight; 
                    let wPeer = activeWeights.peerWeight; 
                    let wObs = activeWeights.observationWeight;
                    let wAtt = activeWeights.attendanceWeight;

                    let activeWeightSum = 0;
                    let accumulatedScore = 0;

                    if (!isNaN(sScore)) { activeWeightSum += wStudent; accumulatedScore += (sScore * wStudent); }
                    if (!isNaN(pScore)) { activeWeightSum += wPeer; accumulatedScore += (pScore * wPeer); }
                    if (!isNaN(oScore)) { activeWeightSum += wObs; accumulatedScore += (oScore * wObs); }
                    if (!isNaN(aScore)) { activeWeightSum += wAtt; accumulatedScore += (aScore * wAtt); }

                    const finalDynamicAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-';

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{row.name}</span>
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{row.role.replace('_', ' ')}</span>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-[#008c99]">{row.studentAvg !== '-' ? row.studentAvg : <span className="text-gray-300">-</span>}</td>
                        <td className="py-4 px-4 text-center font-bold text-[#f39c12]">{row.peerAvg !== '-' ? row.peerAvg : <span className="text-gray-300">-</span>}</td>
                        <td className="py-4 px-4 text-center font-bold text-green-600">{obsAvgDisplay !== '-' ? obsAvgDisplay : <span className="text-gray-300">-</span>}</td>
                        <td className="py-4 px-4 text-center font-bold text-teal-600">{attAvgDisplay !== '-' ? attAvgDisplay : <span className="text-gray-300">-</span>}</td>
                        
                        <td className="py-4 px-6 text-center bg-blue-50/50 border-l border-blue-100 print:bg-transparent print:border-l-0">
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
      )}
    </div>
  );
}