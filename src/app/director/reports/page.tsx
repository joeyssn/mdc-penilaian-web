'use client';
import { useEffect, useMemo, useState } from 'react';
import RoleNav from '@/components/RoleNav';

type Who = { name: string; role: string; level: string | null };
type Ev = { id: string; type: string; period: string; date: string; rubric: string; average: number; evaluator: Who; target: Who; answers: { text: string; value: number }[] };
type Obs = { id: string; date: string; kelas: string; subject: string; target: string; observer: string; finalScore: number; approved: boolean; notesPositive: string; notesImprovement: string };

const TYPES: Record<string, { label: string; cls: string }> = {
  PEER: { label: 'Peer', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  SUPERVISOR: { label: 'Supervisor', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  KOORDINATOR: { label: 'Koordinator', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  STUDENT: { label: 'Student', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  OBSERVATION: { label: 'Observation', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};
const pretty = (r: string) => r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const SCHOOLS = ['TK', 'SD', 'SMP', 'SMA'];

export default function DirectorReports() {
  const [ev, setEv] = useState<Ev[]>([]);
  const [obs, setObs] = useState<Obs[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [type, setType] = useState('ALL');
  const [school, setSchool] = useState('ALL');
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/director/rubric-report').then(async r => {
      if (!r.ok) return setState('error');
      const d = await r.json(); setEv(d.evaluations); setObs(d.observations); setState('ok');
    }).catch(() => setState('error'));
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, { target: Who; evs: Ev[] }>();
    for (const e of ev) {
      if (type !== 'ALL' && e.type !== type) continue;
      if (school !== 'ALL' && (e.target.level || '').toUpperCase() !== school) continue;
      if (q && !e.target.name.toLowerCase().includes(q.toLowerCase())) continue;
      const k = e.target.name + '|' + e.target.role;
      if (!m.has(k)) m.set(k, { target: e.target, evs: [] });
      m.get(k)!.evs.push(e);
    }
    return [...m.values()].sort((a, b) => (a.target.level || '').localeCompare(b.target.level || '') || a.target.name.localeCompare(b.target.name));
  }, [ev, type, school, q]);

  const obsShown = useMemo(() => (type === 'ALL' || type === 'OBSERVATION') ? obs.filter(o => !q || o.target.toLowerCase().includes(q.toLowerCase())) : [], [obs, type, q]);
  const show = (t: string) => <span className={`inline-block border rounded px-2 py-0.5 text-xs font-bold ${TYPES[t]?.cls ?? ''}`}>{TYPES[t]?.label ?? t}</span>;

  return (
    <div className="min-h-screen bg-gray-50 text-[#053b50]">
      <style>{`@media print{.noprint{display:none!important}.brk{break-inside:avoid;page-break-inside:avoid}body{background:#fff}}`}</style>
      <div className="noprint"><RoleNav /></div>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Rubric Reports</h1>
            <p className="text-gray-600 text-sm">Every rubric score given to every user, separated by who is evaluated and by evaluation type. Scores are 1–4.</p>
          </div>
          <button onClick={() => window.print()} className="noprint bg-[#008c99] hover:bg-[#007b87] text-white px-5 py-2.5 rounded-lg font-bold shadow">Print / Save PDF</button>
        </div>

        <div className="noprint flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
          <select value={type} onChange={e => setType(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">All evaluation types</option>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={school} onChange={e => setSchool(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">All schools</option>
            {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by evaluated person…" className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]" />
        </div>

        {state === 'loading' && <p>Loading…</p>}
        {state === 'error' && <p className="text-red-600 font-bold">Could not load the report (Director or Admin only).</p>}

        {state === 'ok' && groups.length === 0 && obsShown.length === 0 && <p className="text-gray-500 font-bold">No data for this filter.</p>}

        {groups.map(g => (
          <section key={g.target.name + g.target.role} className="brk bg-white border border-gray-300 rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 mb-3">
              <h2 className="text-xl font-extrabold">{g.target.name}</h2>
              <span className="text-sm text-gray-600">{pretty(g.target.role)}{g.target.level ? ` · ${g.target.level}` : ''}</span>
            </div>
            {Object.keys(TYPES).filter(t => g.evs.some(e => e.type === t)).map(t => {
              const list = g.evs.filter(e => e.type === t);
              const avg = list.reduce((s, e) => s + e.average, 0) / list.length;
              return (
                <div key={t} className="mb-4">
                  <div className="flex items-center gap-3 mb-1">{show(t)}<span className="text-sm text-gray-600">{list.length} evaluation(s) · average <b>{avg.toFixed(2)}</b></span></div>
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-gray-100 text-left"><th className="p-2">Evaluator</th><th className="p-2">Rubric</th><th className="p-2">Period</th><th className="p-2 text-right">Score</th></tr></thead>
                    <tbody>
                      {list.map(e => (
                        <tr key={e.id} className="border-t align-top">
                          <td className="p-2">{e.evaluator.name}<div className="text-xs text-gray-500">{pretty(e.evaluator.role)}{e.evaluator.level ? ` · ${e.evaluator.level}` : ''}</div></td>
                          <td className="p-2">{e.rubric}
                            <details className="noprint"><summary className="text-xs text-[#008c99] cursor-pointer">Per question</summary>
                              <ul className="text-xs mt-1 space-y-0.5">{e.answers.map((a, i) => <li key={i}>{a.value} — {a.text}</li>)}</ul></details>
                            <ul className="hidden print:block text-xs mt-1">{e.answers.map((a, i) => <li key={i}>{a.value} — {a.text}</li>)}</ul>
                          </td>
                          <td className="p-2">{e.period}</td>
                          <td className="p-2 text-right font-bold">{e.average.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        ))}

        {obsShown.length > 0 && (
          <section className="brk bg-white border border-gray-300 rounded-xl p-5">
            <div className="flex items-center gap-3 border-b pb-2 mb-3"><h2 className="text-xl font-extrabold">Class observations</h2>{show('OBSERVATION')}</div>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-100 text-left"><th className="p-2">Date</th><th className="p-2">Teacher</th><th className="p-2">Observer</th><th className="p-2">Class / subject</th><th className="p-2">Status</th><th className="p-2 text-right">Score</th></tr></thead>
              <tbody>{obsShown.map(o => (
                <tr key={o.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{o.date}</td><td className="p-2 font-semibold">{o.target}</td><td className="p-2">{o.observer}</td>
                  <td className="p-2">{o.kelas} · {o.subject}</td>
                  <td className="p-2">{o.approved ? 'Approved' : 'Pending'}</td>
                  <td className="p-2 text-right font-bold">{o.finalScore.toFixed(2)}</td>
                </tr>))}</tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
