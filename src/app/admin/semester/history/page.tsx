'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface ArchiveRecord {
  id: string;
  semester: string;
  targetId: string;
  targetName: string;
  targetRole: string;
  scoresData: any[] | null;
  evalLogsData: any[] | null;
  observationsData: any[] | null;
  absenceData: any | null;
  sdData?: any[] | null;
  labelsData?: { users: Record<string, string>; indicators: Record<string, string>; rubrics: Record<string, string> } | null;
  archivedAt: string;
}

export default function SemesterHistoryPage() {
  const [semesters, setSemesters] = useState<string[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [live, setLive] = useState<{ users: Record<string, string>; indicators: Record<string, string> }>({ users: {}, indicators: {} });
  const [savingId, setSavingId] = useState<string | null>(null);

  const userName = (rec: ArchiveRecord, id: string) => rec.labelsData?.users?.[id] ?? live.users[id] ?? '(unknown user)';
  const question = (rec: ArchiveRecord, id: string) => rec.labelsData?.indicators?.[id] ?? live.indicators[id] ?? '(question no longer exists)';
  const LETTER_TO_NUM: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

  // Save one edited score; the server returns the updated record
  const editScore = async (rec: ArchiveRecord, body: Record<string, unknown>, key: string) => {
    setSavingId(key);
    try {
      const res = await fetch('/api/admin/semester/archive', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: rec.id, ...body }) });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Could not save the change.');
      setRecords(rs => rs.map(r => (r.id === data.id ? data : r)));
      setActiveModalRecord(data);
    } finally { setSavingId(null); }
  };

  // Modal detail viewer
  const [activeModalRecord, setActiveModalRecord] = useState<ArchiveRecord | null>(null);

  // Fetch archives on filter changes
  useEffect(() => {
    fetchHistory();
  }, [selectedSemester, selectedRole]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSemester) params.set('semester', selectedSemester);
      if (selectedRole !== 'ALL') params.set('role', selectedRole);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/semester/history?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setSemesters(data.semesters || []);
        if (!selectedSemester && data.activeSemester) {
          setSelectedSemester(data.activeSemester);
        }
        setRecords(data.records || []);
        if (data.live) setLive(data.live);
      }
    } catch (err) {
      console.error("Failed to load archive history", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  // CSV Export Generator
  const exportToCSV = () => {
    if (records.length === 0) return alert("No archive records available to export.");

    const headers = [
      "Semester",
      "User Name",
      "Role",
      "Total Scores Recorded",
      "Total Evaluation Logs",
      "Observations Count",
      "Attendance Score",
      "Archived At",
    ];

    const rows = records.map((rec) => [
      `"${rec.semester}"`,
      `"${rec.targetName}"`,
      `"${rec.targetRole}"`,
      rec.scoresData ? rec.scoresData.length : 0,
      rec.evalLogsData ? rec.evalLogsData.length : 0,
      rec.observationsData ? rec.observationsData.length : 0,
      rec.absenceData ? rec.absenceData.attendanceScore : 0,
      `"${new Date(rec.archivedAt).toLocaleString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Semester_Archive_${selectedSemester.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center border-b border-gray-200">
        <h1 className="text-xl font-extrabold text-[#053b50]">Admin Master Panel</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/semester" className="text-gray-500 hover:text-[#008c99] font-bold text-sm transition-colors">
            ⚙️ Semester Control
          </Link>
          <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold text-sm transition-colors">
            ← Overview
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Semester Archive History</h1>
            <p className="text-gray-500 mt-1 font-medium">
              Inspect historical score evaluations, self-reflections, observations, and attendance logs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/api/admin/semester/export"
              className="bg-[#053b50] hover:bg-[#032838] text-white font-bold py-3 px-5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              📦 Download Full Archive (.xlsx)
            </a>
            {selectedSemester && (
              <a
                href={`/api/admin/semester/export?semester=${encodeURIComponent(selectedSemester)}`}
                className="bg-[#008c99] hover:bg-[#00737e] text-white font-bold py-3 px-5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                📥 This Semester (.xlsx)
              </a>
            )}
            <button
              onClick={exportToCSV}
              disabled={records.length === 0}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-3 px-5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Summary CSV
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-bold text-gray-800 outline-none focus:border-[#008c99]"
            >
              {semesters.length === 0 ? (
                <option value="">No archives found</option>
              ) : (
                semesters.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              User Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-bold text-gray-800 outline-none focus:border-[#008c99]"
            >
              <option value="ALL">All Roles</option>
              <option value="TEACHER">Teachers</option>
              <option value="STUDENT">Students</option>
              <option value="STAFF">Staff</option>
              <option value="PRINCIPAL">Principals</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="md:col-span-2 flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Search Name
              </label>
              <input
                type="text"
                placeholder="Search user name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-medium text-gray-800 outline-none focus:border-[#008c99]"
              />
            </div>
            <button
              type="submit"
              className="self-end bg-[#053b50] hover:bg-[#032735] text-white font-bold py-3 px-5 rounded-xl transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-bold">Loading archived records...</div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-medium">
              No archive entries found for the selected semester and filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">User Name</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6 text-center">Scores</th>
                    <th className="py-4 px-6 text-center">Eval Logs</th>
                    <th className="py-4 px-6 text-center">Observations</th>
                    <th className="py-4 px-6 text-center">Attendance</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900">{rec.targetName}</td>
                      <td className="py-4 px-6">
                        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-extrabold">
                          {rec.targetRole}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {rec.scoresData ? rec.scoresData.length : 0} entries
                      </td>
                      <td className="py-4 px-6 text-center">
                        {rec.evalLogsData ? rec.evalLogsData.length : 0} logs
                      </td>
                      <td className="py-4 px-6 text-center">
                        {rec.observationsData ? rec.observationsData.length : 0} records
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-gray-900">
                        {rec.absenceData ? `${rec.absenceData.attendanceScore}%` : '-'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setActiveModalRecord(rec)}
                          className="text-[#008c99] hover:underline font-bold text-xs"
                        >
                          View / Edit Scores
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Detail Modal */}
      {activeModalRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-extrabold text-[#053b50]">
                  {activeModalRecord.targetName}
                </h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">
                  Semester: {activeModalRecord.semester} • Role: {activeModalRecord.targetRole}
                </p>
              </div>
              <button
                onClick={() => setActiveModalRecord(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 font-sans">
              {/* Scores Section (editable) */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-1">
                  Archived Rubric Scores ({activeModalRecord.scoresData?.length || 0})
                </h3>
                <p className="text-xs text-gray-500 mb-3">Change a score with the dropdown. Every change is saved at once and written to the audit log.</p>
                {activeModalRecord.scoresData && activeModalRecord.scoresData.length > 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 text-xs divide-y divide-gray-200 max-h-72 overflow-y-auto">
                    {activeModalRecord.scoresData.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 truncate">{question(activeModalRecord, s.indicatorId)}</p>
                          <p className="text-gray-500">by {userName(activeModalRecord, s.graderId)}</p>
                        </div>
                        <select
                          disabled={savingId === s.id}
                          value={LETTER_TO_NUM[s.value] ?? ''}
                          onChange={(e) => editScore(activeModalRecord, { kind: 'score', scoreId: s.id, value: Number(e.target.value) }, s.id)}
                          className="border border-gray-300 rounded-lg px-2 py-1 font-bold text-gray-800 bg-white"
                        >
                          {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No score entries recorded.</p>
                )}
              </div>

              {/* SD evaluations (editable) */}
              {activeModalRecord.sdData && activeModalRecord.sdData.length > 0 && (
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-3">
                    SD Evaluations ({activeModalRecord.sdData.length})
                  </h3>
                  <div className="space-y-3">
                    {activeModalRecord.sdData.map((ev: any) => (
                      <details key={ev.id} className="bg-gray-50 rounded-xl border border-gray-200 text-xs">
                        <summary className="p-3 cursor-pointer font-bold text-gray-800 flex justify-between gap-3">
                          <span>{ev.type} · by {userName(activeModalRecord, ev.evaluatorId)}</span>
                          <span className="text-[#008c99]">avg {Number(ev.average).toFixed(2)}</span>
                        </summary>
                        <div className="divide-y divide-gray-200 border-t border-gray-200">
                          {(ev.answers || []).map((a: any) => (
                            <div key={a.indicatorId} className="flex items-center justify-between gap-3 p-3">
                              <p className="text-gray-700 min-w-0">{question(activeModalRecord, a.indicatorId)}</p>
                              <select
                                disabled={savingId === ev.id + a.indicatorId}
                                value={a.value}
                                onChange={(e) => editScore(activeModalRecord, { kind: 'sd', evaluationId: ev.id, indicatorId: a.indicatorId, value: Number(e.target.value) }, ev.id + a.indicatorId)}
                                className="border border-gray-300 rounded-lg px-2 py-1 font-bold text-gray-800 bg-white"
                              >
                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Observations Section */}
              <div>
                <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-3">
                  Archived Observations ({activeModalRecord.observationsData?.length || 0})
                </h3>
                {activeModalRecord.observationsData && activeModalRecord.observationsData.length > 0 ? (
                  <div className="space-y-3">
                    {activeModalRecord.observationsData.map((obs, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>Observer: {obs.observerName}</span>
                          <span>Final Score: {obs.finalScore}</span>
                        </div>
                        <p className="text-gray-600">Topic: {obs.topic}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No observation entries recorded.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setActiveModalRecord(null)}
                className="bg-gray-800 hover:bg-gray-900 text-white font-bold px-5 py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}