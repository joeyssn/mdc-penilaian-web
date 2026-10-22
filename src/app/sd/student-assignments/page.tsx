'use client';

import { useCallback, useEffect, useState } from 'react';
import SdShell from '@/components/SdShell';

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data.error || 'Something went wrong'); return null; }
  return data;
}

export default function StudentAssignmentsPage() {
  const [me, setMe] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [data, setData] = useState<{ eligible: any[]; students: any[] } | null>(null);
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [selTeachers, setSelTeachers] = useState<string[]>([]);

  const period = periods.find(p => p.id === periodId);
  const canEdit = me?.role === 'VICE_PRINCIPAL_KESISWAAN' && period && period.status !== 'CLOSED';

  useEffect(() => { (async () => {
    setMe(await (await fetch('/api/me')).json());
    const ps = await (await fetch('/api/sd/periods')).json();
    if (Array.isArray(ps)) { setPeriods(ps); setPeriodId(ps.find((p: any) => p.status === 'OPEN')?.id || ps[0]?.id || ''); }
  })(); }, []);
  useEffect(() => { if (!periodId) return; (async () => {
    const r = await fetch(`/api/sd/student-assignments?periodId=${periodId}`); if (r.ok) { const d = await r.json(); setClasses(d.classes); setClassName(c => d.classes.includes(c) ? c : d.classes[0] ?? ''); }
  })(); }, [periodId]);
  const load = useCallback(async () => {
    if (!periodId || !className) return setData(null);
    const r = await fetch(`/api/sd/student-assignments?periodId=${periodId}&className=${encodeURIComponent(className)}`);
    if (r.ok) setData(await r.json());
    setSelStudents([]); setSelTeachers([]);
  }, [periodId, className]);
  useEffect(() => { load(); }, [load]);

  const apply = async (mode: 'add' | 'remove' | 'replace', students = selStudents) => {
    if (!students.length) return alert('Select at least one student.');
    if (mode !== 'replace' && !selTeachers.length) return alert('Select at least one teacher.');
    if (mode === 'replace' && !selTeachers.length && !confirm('This removes ALL teachers from the selected students. Continue?')) return;
    if (await call('/api/sd/student-assignments', 'PUT', { periodId, studentIds: students, teacherIds: selTeachers, mode })) load();
  };
  const toggle = (arr: string[], set: (a: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  const btn = 'px-3 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-3 py-2 rounded-xl text-sm font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';
  const students = data?.students ?? [];
  const missing = students.filter(s => s.assigned.length === 0);
  const submitted = students.reduce((a, s) => a + s.assigned.filter((x: any) => x.submitted).length, 0);
  const total = students.reduce((a, s) => a + s.assigned.length, 0);

  return (
    <SdShell title="Student → Teacher Assignments" subtitle="Students evaluate only the teachers you assign here. Nothing is assigned automatically.">
      <div className="flex flex-wrap gap-2">
        <select className="border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm" value={periodId} onChange={e => setPeriodId(e.target.value)}>{periods.map(p => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}</select>
        <select className="border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm" value={className} onChange={e => setClassName(e.target.value)}>{classes.map(c => <option key={c}>{c}</option>)}</select>
      </div>
      {classes.length === 0 && periodId && <p className="text-sm text-gray-500">No published groups in this period yet, so there are no teachers to assign.</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4"><div className="text-3xl font-extrabold text-[#008c99]">{students.length}</div><div className="text-xs text-gray-500">students</div></div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4"><div className={`text-3xl font-extrabold ${missing.length ? 'text-red-600' : 'text-[#008c99]'}`}>{missing.length}</div><div className="text-xs text-gray-500">without assignment</div></div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4"><div className="text-3xl font-extrabold text-[#008c99]">{submitted}/{total}</div><div className="text-xs text-gray-500">submitted</div></div>
          </div>

          {canEdit && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
              <p className="font-semibold text-sm">1. Pick teachers  2. Pick students  3. Apply</p>
              <div className="flex flex-wrap gap-2">
                {data.eligible.map(t => (
                  <label key={t.teacherId} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${selTeachers.includes(t.teacherId) ? 'bg-[#008c99] text-white border-[#008c99]' : ''}`}>
                    <input type="checkbox" className="sr-only" checked={selTeachers.includes(t.teacherId)} onChange={() => toggle(selTeachers, setSelTeachers, t.teacherId)} />{t.name} · {t.subject}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => apply('add')}>Add to selected</button>
                <button className={ghost} onClick={() => apply('replace')}>Replace for selected</button>
                <button className={ghost} onClick={() => apply('remove')}>Remove from selected</button>
                <button className={ghost} onClick={() => setSelStudents(selStudents.length === students.length ? [] : students.map(s => s.id))}>{selStudents.length === students.length ? 'Select none' : 'Select whole class'}</button>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th className="p-3 w-8" /><th>Student</th><th>Assigned teachers</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{canEdit && <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggle(selStudents, setSelStudents, s.id)} />}</td>
                    <td className="py-2">{s.name}</td>
                    <td>{s.assigned.length === 0 ? <span className="text-red-600">none</span> : s.assigned.map((a: any) => {
                      const t = data.eligible.find(e => e.teacherId === a.teacherId);
                      return <span key={a.assignmentId} className={`inline-block mr-2 px-2 py-0.5 rounded-full text-xs ${a.submitted ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{t?.name ?? 'Teacher'}{a.submitted ? ' ✓' : ''}</span>;
                    })}</td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan={3} className="p-4 text-gray-400">No students found for this class.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SdShell>
  );
}
