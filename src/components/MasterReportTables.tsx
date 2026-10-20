'use client';

import { useState } from 'react';
import type { MasterRow } from '@/lib/masterReport';

const fmt = (n: number | null | undefined, digits = 2) =>
  typeof n === 'number' && !isNaN(n) ? n.toFixed(digits) : '-';
const num = (n: number | null | undefined) =>
  typeof n === 'number' && !isNaN(n) ? Math.round(n * 100) / 100 : '';

type Col = { key: string; label: string; color: string; value: (r: MasterRow) => number | null };

const SD_COLS: Col[] = [
  { key: 'student', label: 'Student', color: 'text-[#008c99]', value: r => r.student },
  { key: 'peer', label: 'Peer', color: 'text-[#f39c12]', value: r => r.peer },
  { key: 'self', label: 'Self', color: 'text-purple-600', value: r => r.self },
  { key: 'supervisor', label: 'Supervisor', color: 'text-green-600', value: r => r.supervisor },
  { key: 'leader', label: 'Leaders', color: 'text-rose-600', value: r => r.leader },
  { key: 'main', label: 'Main', color: 'text-[#053b50]', value: r => r.main },
  { key: 'hrd', label: 'HRD', color: 'text-teal-600', value: r => r.attendance },
];
const SMP_COLS: Col[] = [
  { key: 'student', label: 'Student', color: 'text-[#008c99]', value: r => r.student },
  { key: 'peer', label: 'Peer', color: 'text-[#f39c12]', value: r => r.peer },
  { key: 'self', label: 'Self', color: 'text-purple-600', value: r => r.self },
  { key: 'observation', label: 'Observation', color: 'text-green-600', value: r => r.observation },
  { key: 'attendance', label: 'Attendance (HRD)', color: 'text-teal-600', value: r => r.attendance },
];

function ReportTable({ title, subtitle, fileTag, cols, rows }: {
  title: string; subtitle: string; fileTag: string; cols: Col[]; rows: MasterRow[];
}) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const data = rows.map(r => {
        const row: Record<string, string | number> = { Name: r.name, Role: r.role.replace(/_/g, ' ') };
        cols.forEach(c => { row[c.label] = num(c.value(r)); });
        row['Final Score'] = num(r.final);
        row['Status'] = r.incomplete ? `Belum lengkap: ${r.missing.join(', ')}` : r.final === null ? 'Belum ada data' : 'Lengkap';
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 28 }, { wch: 24 }, ...cols.map(() => ({ wch: 14 })), { wch: 12 }, { wch: 34 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, fileTag.slice(0, 31));
      XLSX.writeFile(wb, `Master_Report_${fileTag}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none break-inside-avoid">
      <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#053b50] text-lg">{title} <span className="text-sm font-bold text-gray-500">({rows.length})</span></h3>
          <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
        </div>
        <button
          onClick={download}
          disabled={busy || rows.length === 0}
          className="print:hidden bg-[#008c99] hover:bg-[#007b87] text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-40 whitespace-nowrap"
        >
          {busy ? 'Preparing...' : 'Download Excel'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200 print:bg-gray-100">
              <th className="py-3 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Staff Name</th>
              {cols.map(c => (
                <th key={c.key} className={`py-3 px-3 font-bold uppercase text-xs tracking-wider text-center ${c.color}`}>{c.label}</th>
              ))}
              <th className="py-3 px-6 font-extrabold text-[#053b50] bg-blue-50 uppercase text-xs tracking-wider text-center border-l border-blue-100 print:bg-transparent">Final Average</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                <td className="py-3 px-6">
                  <span className="font-bold text-gray-900 block">{r.name}</span>
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{r.role.replace(/_/g, ' ')}</span>
                </td>
                {cols.map(c => {
                  const v = fmt(c.value(r));
                  return <td key={c.key} className={`py-3 px-3 text-center font-bold ${c.color}`}>{v === '-' ? <span className="text-gray-300">-</span> : v}</td>;
                })}
                <td className="py-3 px-6 text-center bg-blue-50/50 border-l border-blue-100 print:bg-transparent">
                  <span className={`font-extrabold text-xl ${r.final === null ? 'text-gray-300' : 'text-[#053b50]'}`}>{fmt(r.final)}</span>
                  {r.incomplete && <span className="block text-[10px] font-bold text-amber-600 uppercase">Belum: {r.missing.join(', ')}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 2} className="py-8 text-center text-gray-500 font-bold">Belum ada data evaluasi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The master report, split into two tables so each school group can be read and downloaded on its own.
export default function MasterReportTables({ rows, loading = false }: { rows: MasterRow[]; loading?: boolean }) {
  if (loading) return <div className="p-12 text-center text-gray-500 font-bold">Generating Report...</div>;
  return (
    <div className="space-y-8">
      <ReportTable
        title="SD / TK"
        subtitle="Main (Peer, Self, Supervisor, Leaders) + Student + HRD"
        fileTag="SD-TK"
        cols={SD_COLS}
        rows={rows.filter(r => r.group === 'SD')}
      />
      <ReportTable
        title="SMP / SMA"
        subtitle="Student, Peer, Self, Observation and Attendance (people without a school level are listed here)"
        fileTag="SMP-SMA"
        cols={SMP_COLS}
        rows={rows.filter(r => r.group === 'SMP')}
      />
    </div>
  );
}
