'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CycleLockPanel from '@/components/CycleLockPanel';
import { WEIGHT_PROFILES, LEGACY_PROFILE_IDS, SD_DEFAULT_WEIGHTS, computeFinal, fallbackIds, isSdLayout, isSdProfile, profileLabel, resolveProfile, roleLabel, validateSdWeights, type FullWeights } from '@/lib/weights';

type ReportRow = { 
  id: string; 
  name: string; 
  role: string; 
  roleKey?: string; 
  level?: string | null; 
  department: string; 
  studentCount: number; 
  peerCount: number; 
  selfCount: number; 
  studentAvg: string; 
  peerAvg: string; 
  selfAvg: string; 
  overallAvg: string; 
};
type Observation = { id: string; targetId: string; targetName: string; finalScore: number; isApproved: boolean; };
type GroupedObservation = { targetId: string; averageScore: number; records: Observation[]; };
type Absence = { id: string; userId: string; userName: string; attendanceScore: number; };

type ChartData = { name: string; value: number; fill: string };
type Totals = { totalStudents: number; activeStudents: number; totalTeachersStaff: number; activeTeachersStaff: number; overallTotal: number; overallActive: number; };

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

export default function AdminDashboard() {
  const defaultWeights: FullWeights = { 
    studentWeight: 20, 
    peerWeight: 20, 
    selfWeight: 20, 
    observationWeight: 20, 
    attendanceWeight: 20,
    mainWeight: 0, supervisorWeight: 0, leaderWeight: 0
  };
  const toFull = (w: any): FullWeights => ({
    studentWeight: Number(w.studentWeight) || 0,
    peerWeight: Number(w.peerWeight) || 0,
    selfWeight: Number(w.selfWeight) || 0,
    observationWeight: Number(w.observationWeight) || 0,
    attendanceWeight: Number(w.attendanceWeight) || 0,
    mainWeight: Number(w.mainWeight) || 0,
    supervisorWeight: Number(w.supervisorWeight) || 0,
    leaderWeight: Number(w.leaderWeight) || 0,
  });
  // Valid = totals exactly 100 (SD / TK: overall split AND the split inside the main evaluation)
  const isValidProfile = (id: string, w: FullWeights) =>
    isSdProfile(id)
      ? validateSdWeights(w) === null
      : (w.studentWeight + w.peerWeight + w.selfWeight + w.observationWeight + w.attendanceWeight) === 100;
  
  const [weightsConfig, setWeightsConfig] = useState<Record<string, FullWeights>>({});
  const [selectedRoleWeight, setSelectedRoleWeight] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
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
        let loadedConfig: Record<string, FullWeights> = {};
        wData.forEach((w: any) => { loadedConfig[w.id] = toFull(w); });
        // One profile per role for SMP / SMA and a separate set for SD. A profile that has not been
        // saved yet starts from the closest existing one (an SD profile from its SMP / SMA twin),
        // or equal 20% weights. Nothing changes until you press Save.
        const byId: Record<string, any> = { ...loadedConfig };
        const ordered: Record<string, FullWeights> = {};
        WEIGHT_PROFILES.forEach(id => {
          const source = byId[id] || fallbackIds(id).map(f => byId[f]).find(Boolean);
          ordered[id] = toFull(source || defaultWeights);
          // SD / TK profiles use the main/student/HRD layout. One without it (an old profile or a copy
          // of SMP / SMA) starts from 79 / 11 / 10 and 10 / 10 / 20 / 60; nothing changes until Save.
          if (isSdProfile(id) && !isSdLayout(ordered[id])) ordered[id] = { ...SD_DEFAULT_WEIGHTS };
          byId[id] = ordered[id];
        });
        loadedConfig = ordered;
        setWeightsConfig(loadedConfig);
        setSelectedRoleWeight(prev => (prev && loadedConfig[prev] ? prev : Object.keys(loadedConfig)[0]));
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

  const currentW = weightsConfig[selectedRoleWeight] || defaultWeights;
  const sdSelected = isSdProfile(selectedRoleWeight);
  const currentInner = currentW.peerWeight + currentW.selfWeight + currentW.supervisorWeight + currentW.leaderWeight;
  const currentTotal = sdSelected
    ? currentW.mainWeight + currentW.studentWeight + currentW.attendanceWeight
    : currentW.studentWeight + currentW.peerWeight + currentW.selfWeight + currentW.observationWeight + currentW.attendanceWeight;
  const currentValid = isValidProfile(selectedRoleWeight, currentW);

  const updateWeight = (field: string, value: number) => {
    setWeightsConfig(prev => ({ 
      ...prev, 
      [selectedRoleWeight]: { 
        ...prev[selectedRoleWeight], 
        [field]: value 
      } 
    }));
  };

  // Profiles that can still be added (not configured yet)
  const availableProfileIds = WEIGHT_PROFILES.filter(id => !weightsConfig[id]);

  const handleSaveWeights = async () => {
    const invalid = Object.entries(weightsConfig)
      .filter(([id, w]) => !isValidProfile(id, w));

    if (invalid.length > 0) {
      const names = invalid.map(([id]) => profileLabel(id)).join(', ');
      return alert(`Error: The total percentage for ${names} is not valid: every total must be exactly 100%. Please fix before saving.`);
    }

    setIsSaving(true);
    const payload = Object.entries(weightsConfig).map(([id, w]) => ({ id, ...w }));
    const res = await fetch('/api/settings/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) alert("Role-Based Scoring Weights Updated! The Director's Report is now locked into these new percentages.");
    else alert((await res.json().catch(() => null))?.error || 'Failed to save weights.');
    setIsSaving(false);
  };

  const handleAddProfile = () => {
    if (!newProfileId || weightsConfig[newProfileId]) return;
    setWeightsConfig(prev => ({ ...prev, [newProfileId]: isSdProfile(newProfileId) ? { ...SD_DEFAULT_WEIGHTS } : { ...defaultWeights } }));
    setSelectedRoleWeight(newProfileId);
    setNewProfileId('');
  };

  const handleDeleteProfile = async () => {
    if (!selectedRoleWeight) return;
    if (!confirm(`Delete the weight profile for ${profileLabel(selectedRoleWeight)}?\n\n${isSdProfile(selectedRoleWeight) ? 'SD people with this role will use the SMP / SMA profile for the same role.' : 'People with this role will be scored with equal 20% weights.'}`)) return;
    const res = await fetch(`/api/settings/weights?id=${encodeURIComponent(selectedRoleWeight)}`, { method: 'DELETE' });
    if (!res.ok) return alert((await res.json().catch(() => null))?.error || 'Failed to delete weight profile.');
    const remaining = { ...weightsConfig };
    delete remaining[selectedRoleWeight];
    setWeightsConfig(remaining);
    setSelectedRoleWeight(Object.keys(remaining)[0] || '');
  };

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return 'Staff';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff';
    if (upper === 'KARYAWAN') return 'Karyawan';
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL' || upper === 'VICE_PRINCIPAL_KURIKULUM' || upper === 'VICE_PRINCIPAL_KESISWAAN') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return 'Staff';
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading Admin Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans print:bg-white pb-20 print:pb-0">
      
      {/* NAVIGATION HEADER */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 print:hidden gap-4">
        <div className="flex items-center">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        <div className="flex gap-8 text-[15px] font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="pb-1 border-b-2 text-[#053b50] border-[#008c99]">
            Live Overview & Weights
          </span>
        </div>

        <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
      </nav>

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

        {/* ADMIN TOOLS & MANAGEMENT */}
        <div className="print:hidden">
          <div className="mb-10">
            <h2 className="text-2xl font-extrabold text-[#053b50] mb-2">Evaluation Cycles & Score Visibility</h2>
            <p className="text-gray-500 font-medium mb-5">Each cycle belongs to one school level and has its own lock. New cycles start locked.</p>
            <CycleLockPanel canManage />
          </div>

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
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-orange-700">Observation Track Record</h3>
            </Link>

            <Link href="/admin/observasi-template" className="bg-white hover:bg-green-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
              <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-green-700">Edit Observation Rubric</h3>
            </Link>

            <Link href="/admin/students" className="bg-white hover:bg-teal-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
              <div className="bg-teal-100 text-teal-600 p-4 rounded-full mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-teal-700">Manage Students</h3>
            </Link>

            <Link href="/admin/semester" className="bg-white hover:bg-rose-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
              <div className="bg-rose-100 text-rose-600 p-4 rounded-full mb-4 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-rose-700">System Reset</h3>
            </Link>

            <Link href="/admin/semester/history" className="bg-white hover:bg-indigo-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
              <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-indigo-700">Activity History</h3>
            </Link>

            <Link href="/admin/master-report" className="bg-white hover:bg-amber-50 border border-gray-200 p-6 rounded-2xl shadow-sm transition-all group flex flex-col items-center text-center cursor-pointer">
              <div className="bg-amber-100 text-amber-600 p-4 rounded-full mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#053b50] group-hover:text-amber-700">Director Master Report</h3>
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
              <button onClick={handleSaveWeights} disabled={!currentValid || isSaving || Object.keys(weightsConfig).length === 0} className="bg-[#e99a24] hover:bg-[#d68a1f] text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 whitespace-nowrap">
                {isSaving ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="mb-8 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="font-bold text-gray-700">Configure Weights For:</label>
                <select
                  value={selectedRoleWeight}
                  onChange={(e) => setSelectedRoleWeight(e.target.value)}
                  disabled={Object.keys(weightsConfig).length === 0}
                  className="border-2 border-[#008c99] text-[#053b50] font-bold rounded-xl px-4 py-2 bg-blue-50 outline-none w-full md:w-auto"
                >
                  <optgroup label="SMP / SMA">
                    {Object.keys(weightsConfig).filter(id => !isSdProfile(id)).map(id => (
                      <option key={id} value={id}>{roleLabel(id)}</option>
                    ))}
                  </optgroup>
                  <optgroup label="SD">
                    {Object.keys(weightsConfig).filter(isSdProfile).map(id => (
                      <option key={id} value={id}>{roleLabel(id)}</option>
                    ))}
                  </optgroup>
                </select>
                <button
                  onClick={handleDeleteProfile}
                  disabled={!selectedRoleWeight}
                  className="text-red-600 hover:text-white hover:bg-red-600 border border-red-300 px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                >
                  Delete
                </button>
              </div>

              <div className="flex items-center gap-3 lg:ml-auto">
                <select
                  value={newProfileId}
                  onChange={(e) => setNewProfileId(e.target.value)}
                  disabled={availableProfileIds.length === 0}
                  className="border border-gray-300 text-gray-700 rounded-xl px-4 py-2 bg-white outline-none"
                >
                  <option value="">{availableProfileIds.length === 0 ? 'All profiles added' : '+ Add profile for...'}</option>
                  {availableProfileIds.map(id => <option key={id} value={id}>{profileLabel(id)}</option>)}
                </select>
                <button
                  onClick={handleAddProfile}
                  disabled={!newProfileId}
                  className="bg-[#008c99] hover:bg-[#007b87] text-white px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>

            {Object.keys(weightsConfig).length === 0 && (
              <p className="mb-6 text-gray-500 font-medium">No weight profiles yet. Add one above to get started. Users without a profile are scored with equal 20% weights.</p>
            )}

            {/* WEIGHT SLIDERS (5 CRITERIA) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {isSdProfile(selectedRoleWeight) ? (
              <>
              <div className="md:col-span-2 text-sm font-medium text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                SD / TK master report. The overall score is split between the <b>Main evaluation</b>, <b>Student</b> and <b>HRD</b>. The Main evaluation is itself made of Peer, Self, Supervisor and Leaders. Observation is not used.
              </div>
              <div className="space-y-6">
                <h4 className="font-extrabold text-[#053b50] uppercase text-xs tracking-wider">Overall score split</h4>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Main Evaluation (Peer, Self, Supervisor, Leaders) <span className="text-[#053b50]">{currentW.mainWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.mainWeight} onChange={(e) => updateWeight('mainWeight', Number(e.target.value))} className="w-full accent-[#053b50]" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Student Evaluation <span className="text-[#008c99]">{currentW.studentWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.studentWeight} onChange={(e) => updateWeight('studentWeight', Number(e.target.value))} className="w-full accent-[#008c99]" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">HRD <span className="text-teal-600">{currentW.attendanceWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.attendanceWeight} onChange={(e) => updateWeight('attendanceWeight', Number(e.target.value))} className="w-full accent-teal-600" />
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="font-extrabold text-[#053b50] uppercase text-xs tracking-wider">Inside the main evaluation</h4>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Peer <span className="text-[#f39c12]">{currentW.peerWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.peerWeight} onChange={(e) => updateWeight('peerWeight', Number(e.target.value))} className="w-full accent-[#f39c12]" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Self Reflection <span className="text-purple-600">{currentW.selfWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.selfWeight} onChange={(e) => updateWeight('selfWeight', Number(e.target.value))} className="w-full accent-purple-600" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Supervisor <span className="text-green-600">{currentW.supervisorWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.supervisorWeight} onChange={(e) => updateWeight('supervisorWeight', Number(e.target.value))} className="w-full accent-green-600" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Leaders (Principal / Vice Principal) <span className="text-rose-600">{currentW.leaderWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.leaderWeight} onChange={(e) => updateWeight('leaderWeight', Number(e.target.value))} className="w-full accent-rose-600" />
                </div>
              </div>
              </>
              ) : (
              <>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Student Evaluation <span className="text-[#008c99]">{currentW.studentWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.studentWeight} onChange={(e) => updateWeight('studentWeight', Number(e.target.value))} className="w-full accent-[#008c99]" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Peer Evaluation <span className="text-[#f39c12]">{currentW.peerWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.peerWeight} onChange={(e) => updateWeight('peerWeight', Number(e.target.value))} className="w-full accent-[#f39c12]" />
                </div>
                <div className="space-y-2">
                  <label className="font-bold text-gray-700 flex justify-between">Self Reflection Evaluation <span className="text-purple-600">{currentW.selfWeight}%</span></label>
                  <input type="range" min="0" max="100" value={currentW.selfWeight} onChange={(e) => updateWeight('selfWeight', Number(e.target.value))} className="w-full accent-purple-600" />
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

              </>
              )}

              <div className={`md:col-span-2 p-4 rounded-xl font-bold text-center text-lg transition-colors ${currentValid ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                {sdSelected ? (
                  <>
                    Overall (Main + Student + HRD): {currentTotal}% &nbsp;·&nbsp; Inside Main: {currentInner}%
                    {!currentValid && <span className="block text-sm font-semibold mt-1">Both totals must equal exactly 100%</span>}
                  </>
                ) : (
                  <>Total Weight for {profileLabel(selectedRoleWeight)}: {currentTotal}% {currentTotal !== 100 && "(Adjust sliders so total equals exactly 100%)"}</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LIVE PREVIEW TABLE WITH 5 SCORE COLUMNS */}
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
                  <th className="py-4 px-4 font-bold text-purple-600 uppercase text-xs tracking-wider text-center">Self<br/><span className="text-[10px] text-gray-400 font-normal">Score</span></th>
                  <th className="py-4 px-4 font-bold text-green-600 uppercase text-xs tracking-wider text-center">Observation<br/><span className="text-[10px] text-gray-400 font-normal">Avg Score</span></th>
                  <th className="py-4 px-4 font-bold text-teal-600 uppercase text-xs tracking-wider text-center">Attendance<br/><span className="text-[10px] text-gray-400 font-normal">HRD Score</span></th>
                  <th className="py-4 px-6 font-extrabold text-[#053b50] bg-blue-50 uppercase text-xs tracking-wider text-center border-l border-blue-100 print:bg-transparent print:border-l-0">Simulated Final Average<br/><span className="text-[10px] text-gray-500 font-normal">(Scale 1-4)</span></th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-100">
                {reportData
                  .filter((row) => row.role.toUpperCase() !== 'STUDENT' && row.role.toUpperCase() !== 'ADMIN')
                  .map((row) => {
                  const sScore = parseFloat(row.studentAvg);
                  const pScore = parseFloat(row.peerAvg);
                  const selfScore = parseFloat(row.selfAvg);
                  
                  const obsGroup = groupedObservations.find(g => g.targetId === row.id);
                  const oScore = obsGroup ? obsGroup.averageScore : NaN;
                  const obsAvgDisplay = obsGroup ? obsGroup.averageScore.toFixed(2) : '-';

                  const userAbsence = absences.find(a => a.userId === row.id);
                  const aScore = userAbsence ? userAbsence.attendanceScore : NaN;
                  const attAvgDisplay = userAbsence ? userAbsence.attendanceScore.toFixed(1) : '-';

                  const profileEntries = Object.entries(weightsConfig).map(([id, w]) => ({ id, ...w }));
                  const matched = resolveProfile(profileEntries, row.roleKey || row.role, row.level);
                  const activeWeights = matched || defaultWeights;
                  const sdRow = matched ? isSdProfile(matched.id) : false;

                  const { final, incomplete, main, missing } = computeFinal(
                    matched ? matched.id : 'DEFAULT', activeWeights,
                    // Leaders = the principal / vice principal observation score. Supervisor scores are not collected yet.
                    { student: sScore, peer: pScore, self: selfScore, observation: oScore, attendance: aScore, leader: oScore, supervisor: NaN }
                  );
                  const finalDynamicAvg = final === null ? '-' : final.toFixed(2);

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                      <td className="py-4 px-6">
                        <span className="font-bold text-gray-900 block">{row.name}</span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{row.role.replace('_', ' ')}{sdRow ? ' · SD/TK' : ''}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-[#008c99]">{row.studentAvg !== '-' ? row.studentAvg : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-[#f39c12]">{row.peerAvg !== '-' ? row.peerAvg : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-purple-600">{row.selfAvg !== '-' ? row.selfAvg : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-green-600">{obsAvgDisplay !== '-' ? obsAvgDisplay : <span className="text-gray-300">-</span>}</td>
                      <td className="py-4 px-4 text-center font-bold text-teal-600">{attAvgDisplay !== '-' ? attAvgDisplay : <span className="text-gray-300">-</span>}</td>
                      
                      <td className="py-4 px-6 text-center bg-blue-50/50 border-l border-blue-100 print:bg-transparent print:border-l-0">
                        <span className={`font-extrabold text-xl ${finalDynamicAvg === '-' ? 'text-gray-300' : 'text-[#053b50]'}`}>
                          {finalDynamicAvg}
                        </span>
                        {incomplete && <span className="block text-[10px] font-bold text-amber-600 uppercase">Belum: {missing.join(', ')}</span>}
                        {sdRow && main !== null && <span className="block text-[10px] text-gray-400">Main {main.toFixed(2)}</span>}
                      </td>
                    </tr>
                  );
                })}
                {reportData.filter((row) => row.role.toUpperCase() !== 'STUDENT' && row.role.toUpperCase() !== 'ADMIN').length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500 font-bold">Belum ada data evaluasi di database.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}