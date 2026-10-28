'use client';

import { useEffect, useMemo, useState } from 'react';
import RoleNav from '@/components/RoleNav';

type Mode = { mode: string; label: string; roles: string[] };
type Person = { id: string; name: string; role: string; level?: string | null; division?: string | null };
type Target = Person & { assigned: Record<string, { evaluatorId: string; name: string; submitted: boolean }[]> };
const ROLE_LABEL: Record<string, string> = { SUPERVISOR: 'Evaluator', PEER: 'Peer', KOORDINATOR: 'Koordinator' };
const pretty = (r: string) => r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// One screen for the Director (principal -> vice principal, head -> worker), SMP / SMA principals and vice principals (teachers) and HRD (karyawan).
export default function AssignPage() {
  const [info, setInfo] = useState<any>(null);
  const [mode, setMode] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Target | null>(null);
  const [cands, setCands] = useState<Record<string, Person[]>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const json = async (r: Response) => { try { return await r.json(); } catch { return {}; } };

  useEffect(() => { (async () => {
    const r = await fetch('/api/assign'); const d = await json(r);
    if (!r.ok) { setLoadErr(d.error || 'Could not load this page.'); return; }
    setInfo(d);
    if (d.modes[0]) setMode(d.modes[0].mode);
    if (d.periods[0]) setPeriodId(d.periods[0].id);
  })(); }, []);

  const loadTargets = async (m = mode, p = periodId) => {
    if (!m || !p) { setTargets([]); return; }
    const r = await fetch(`/api/assign?mode=${m}&periodId=${p}`); const d = await json(r);
    setLoadErr(r.ok ? '' : d.error || 'Could not load the list.');
    setTargets(r.ok ? d.targets : []);
  };
  useEffect(() => { setSel(null); loadTargets(); }, [mode, periodId]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (t: Target) => {
    setSel(t); setMsg('');
    setPicked(Object.fromEntries(Object.entries(t.assigned).map(([r, v]) => [r, v.map(x => x.evaluatorId)])));
    const r = await fetch(`/api/assign?mode=${mode}&targetId=${t.id}`); const d = await json(r);
    if (!r.ok) setMsg(d.error || 'Could not load the choices.');
    setCands(r.ok ? d.candidates : {});
  };

  const save = async (role: string) => {
    if (!sel) return; setSaving(role); setMsg('');
    const r = await fetch('/api/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, periodId, targetId: sel.id, role, evaluatorIds: picked[role] || [] }) });
    const d = await json(r); setSaving('');
    setMsg(r.ok ? `Saved for ${sel.name}.` : d.error || 'Could not save.');
    if (r.ok) { await loadTargets(); }
  };

  const shown = useMemo(() => targets.filter(t => t.name.toLowerCase().includes(q.toLowerCase())), [targets, q]);
  const current = info?.modes.find((m: Mode) => m.mode === mode);
  const toggle = (role: string, id: string) => setPicked(p => ({ ...p, [role]: (p[role] || []).includes(id) ? p[role].filter(x => x !== id) : [...(p[role] || []), id] }));

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans text-gray-900 [color-scheme:light] [&_input]:text-gray-900 [&_select]:text-gray-900 [&_select]:bg-white">
      <RoleNav />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-20 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Assign Evaluators</h1>
          <p className="text-gray-700 mt-1">Pick a person, then choose who evaluates them.</p>
        </div>

        {loadErr && <p className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm font-semibold">{loadErr}</p>}

        {info && info.modes.length === 0 && (
          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
            <p className="text-gray-800">You do not assign evaluators.</p>
            {info.toEvaluate.length > 0 && <p><b>You evaluate:</b> {info.toEvaluate.map((x: any) => x.name).join(', ')}</p>}
            {info.evaluatedBy.length > 0 && <p><b>Evaluated by:</b> {info.evaluatedBy.map((x: any) => x.name).join(', ')}</p>}
            {info.toEvaluate.length + info.evaluatedBy.length === 0 && <p className="text-gray-700">Nothing has been assigned to you yet.</p>}
          </section>
        )}

        {info && info.modes.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              {info.modes.length > 1 && (
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                  {info.modes.map((m: Mode) => (
                    <button key={m.mode} onClick={() => setMode(m.mode)} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode === m.mode ? 'bg-[#008c99] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{m.label}</button>
                  ))}
                </div>
              )}
              {info.modes.length === 1 && <span className="font-bold text-[#053b50]">{info.modes[0].label}</span>}
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold">
                {info.periods.length === 0 && <option value="">No open period</option>}
                {info.periods.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
              </select>
            </div>
            {info.periods.length === 0 && <p className="text-sm text-[#b45309] font-semibold">There is no open or draft evaluation period. Ask the principal or admin to create one first.</p>}

            <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3">
                <h2 className="font-extrabold text-[#053b50]">1. Choose a person</h2>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <div className="max-h-[480px] overflow-y-auto divide-y">
                  {shown.length === 0 && <p className="text-sm text-gray-700 py-3">No one to show here yet.</p>}
                  {shown.map(t => {
                    const n = Object.values(t.assigned).reduce((a, v) => a + v.length, 0);
                    return (
                      <button key={t.id} onClick={() => choose(t)} className={`w-full text-left py-3 px-2 rounded-lg flex justify-between items-center gap-3 ${sel?.id === t.id ? 'bg-[#008c99]/10' : 'hover:bg-gray-50'}`}>
                        <span><b>{t.name}</b><span className="block text-xs text-gray-700">{pretty(t.role)}{t.level ? ` · ${t.level}` : ''}{t.division ? ` · ${t.division}` : ''}</span></span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${n ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{n ? `${n} assigned` : 'none'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
                <h2 className="font-extrabold text-[#053b50]">2. Choose evaluators{sel ? ` for ${sel.name}` : ''}</h2>
                {!sel && <p className="text-sm text-gray-700">Select a person on the left.</p>}
                {sel && current?.roles.map((role: string) => (
                  <div key={role} className="space-y-2">
                    <h3 className="font-bold text-[#006e7a]">{current.roles.length > 1 || role !== 'SUPERVISOR' ? ROLE_LABEL[role] : 'Evaluators'}</h3>
                    {(cands[role] || []).length === 0 && <p className="text-sm text-gray-700">No one can be picked for this yet. Check that their role, school or division is set in Users.</p>}
                    <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                      {(cands[role] || []).map(p => (
                        <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={(picked[role] || []).includes(p.id)} onChange={() => toggle(role, p.id)} />
                          <span className="font-semibold">{p.name}</span><span className="text-xs text-gray-700">{pretty(p.role)}{p.level ? ` · ${p.level}` : ''}{p.division ? ` · ${p.division}` : ''}</span>
                        </label>
                      ))}
                    </div>
                    {(cands[role] || []).length > 0 && <button onClick={() => save(role)} disabled={saving === role} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white disabled:opacity-50">{saving === role ? 'Saving…' : `Save ${current.roles.length > 1 ? ROLE_LABEL[role] : 'evaluators'}`}</button>}
                  </div>
                ))}
                {msg && <p className={`text-sm font-semibold ${msg.startsWith('Saved') ? 'text-green-700' : 'text-red-700'}`}>{msg}</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
