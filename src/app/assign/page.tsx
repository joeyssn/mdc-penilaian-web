'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RoleNav from '@/components/RoleNav';
import SdTasks from '@/components/SdTasks';

type Mode = { mode: string; label: string; roles: string[] };
type Person = { id: string; name: string; role: string; level?: string | null; division?: string | null };
type Assigned = { evaluatorId: string; name: string; submitted: boolean };
type Target = Person & { assigned: Record<string, Assigned[]> };

const pretty = (r: string) => r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
// What each role is called on screen, per assignment mode.
const ROLE_TITLE: Record<string, Record<string, string>> = {
  HEAD_WORKERS: { SUPERVISOR: 'Head', PEER: 'Peers', KOORDINATOR: 'Koordinator' },
  PRINCIPAL_VP: { SUPERVISOR: 'Principal', PEER: 'Peers' },
  KARYAWAN: { SUPERVISOR: 'Leader', PEER: 'Peers' },
  SCHOOL_TEACHERS: { SUPERVISOR: 'Supervisor', PEER: 'Peers', KOORDINATOR: 'Koordinator' },
};
const ROLE_HINT: Record<string, string> = {
  SUPERVISOR: 'Who leads / supervises this person? (for a karyawan: the karyawan who leads them)',
  PEER: 'Who evaluates this person as a peer? Colleagues of the same team (for a vice principal: other vice principals).',
  KOORDINATOR: 'Who is the koordinator?',
};
const PERSON_NOUN: Record<string, string> = { HEAD_WORKERS: 'worker', PRINCIPAL_VP: 'vice principal', KARYAWAN: 'karyawan', SCHOOL_TEACHERS: 'teacher' };

// Step-by-step assignment: pick a person, then each evaluator role, then review and save.
// Used by the Director (principal -> vice principal, head -> workers), SMP / SMA principals and vice principals (teachers) and HRD (karyawan).
export default function AssignPage() {
  const [info, setInfo] = useState<any>(null);
  const [mode, setMode] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [cands, setCands] = useState<Record<string, Person[]>>({});
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Target | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [headMsg, setHeadMsg] = useState('');

  const [results, setResults] = useState<any>(null);
  useEffect(() => { (async () => { const r = await fetch('/api/assign/results'); if (r.ok) setResults(await r.json()); })(); }, []);
  const json = async (r: Response) => { try { return await r.json(); } catch { return {}; } };

  useEffect(() => { (async () => {
    const r = await fetch('/api/assign'); const d = await json(r);
    if (!r.ok) { setLoadErr(d.error || 'Could not load this page.'); return; }
    setInfo(d);
    if (d.modes[0]) setMode(d.modes[0].mode);
    const open = d.periods.find((p: any) => p.status === 'OPEN') ?? d.periods[0];
    if (open) setPeriodId(open.id);
  })(); }, []);

  const current: Mode | undefined = info?.modes.find((m: Mode) => m.mode === mode);
  const roles = current?.roles ?? [];
  const period = info?.periods.find((p: any) => p.id === periodId);
  const locked = period?.status === 'CLOSED';
  const noun = PERSON_NOUN[mode] ?? 'person';
  const title = (role: string) => ROLE_TITLE[mode]?.[role] ?? role;

  const steps = useMemo(() => [
    { key: 'PERSON', title: pretty(noun), hint: `Who is being evaluated? Choose a ${noun}.` },
    ...roles.map(r => ({ key: r, title: title(r), hint: ROLE_HINT[r] ?? '' })),
    { key: 'REVIEW', title: 'Review', hint: 'Check and save.' },
  ], [roles, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = steps[step] ?? steps[0];

  const loadTargets = useCallback(async (m = mode, p = periodId) => {
    if (!m || !p) { setTargets([]); return; }
    const r = await fetch(`/api/assign?mode=${m}&periodId=${p}`); const d = await json(r);
    setLoadErr(r.ok ? '' : d.error || 'Could not load the list.');
    setTargets(r.ok ? d.targets : []);
  }, [mode, periodId]);

  const reset = () => { setStep(0); setSel(null); setDraft({}); setQ(''); setDone(''); setCands({}); };
  useEffect(() => { reset(); loadTargets(); }, [mode, periodId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (t: Target, goto = 1) => {
    setSel(t); setQ(''); setDone('');
    setDraft(Object.fromEntries(roles.map(r => [r, (t.assigned[r] ?? []).map(x => x.evaluatorId)])));
    setStep(goto);
    const r = await fetch(`/api/assign?mode=${mode}&targetId=${t.id}`); const d = await json(r);
    if (!r.ok) setLoadErr(d.error || 'Could not load the choices.'); else setCands(d.candidates);
  };
  const go = (n: number) => { setStep(n); setQ(''); };
  const toggle = (role: string, id: string) => setDraft(d => ({ ...d, [role]: (d[role] ?? []).includes(id) ? d[role].filter(x => x !== id) : [...(d[role] ?? []), id] }));
  const nameOf = (id: string) => Object.values(cands).flat().find(p => p.id === id)?.name ?? Object.values(sel?.assigned ?? {}).flat().find(a => a.evaluatorId === id)?.name ?? '(unknown)';

  const saveAll = async () => {
    if (!sel) return; setSaving(true); setLoadErr('');
    for (const role of roles) {
      const before = (sel.assigned[role] ?? []).map(x => x.evaluatorId).sort();
      const after = [...(draft[role] ?? [])].sort();
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const r = await fetch('/api/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, periodId, targetId: sel.id, role, evaluatorIds: draft[role] ?? [] }) });
      const d = await json(r);
      if (!r.ok) { setLoadErr(d.error || 'Could not save.'); setSaving(false); return; }
    }
    setSaving(false); setDone(sel.name); await loadTargets();
  };

  const setHead = async (division: string, headId: string) => {
    setHeadMsg('');
    const r = await fetch('/api/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setHead', division, headId: headId || null, periodId }) });
    const d = await json(r);
    if (!r.ok) return setHeadMsg(d.error || 'Could not save the head.');
    setInfo((i: any) => ({ ...i, heads: { ...i.heads, [division]: headId || undefined } }));
    setHeadMsg(headId ? `Head of ${division} saved${d.added ? `; added to ${d.added} worker(s) without a head` : ''}.` : `Head of ${division} cleared.`);
    loadTargets();
  };

  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';
  const btn = 'px-5 py-3 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-5 py-3 rounded-xl text-sm font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';
  const input = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
  const editable = !locked && !!periodId;

  const pool: any[] = cur.key === 'PERSON' ? targets : (cands[cur.key] ?? []);
  const shown = pool.filter(x => x.name.toLowerCase().includes(q.toLowerCase()));
  const sub = (p: Person) => `${pretty(p.role)}${p.level ? ` · ${p.level}` : ''}${p.division ? ` · ${p.division}` : ''}`;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans text-gray-900 [color-scheme:light] [&_input]:text-gray-900 [&_select]:text-gray-900 [&_select]:bg-white">
      <RoleNav />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-20 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Assign Evaluators</h1>
          <p className="text-gray-700 mt-1">Follow the steps: pick a {noun}, then choose who evaluates them.</p>
        </div>

        {/* Everyone: the people they evaluate, and their own results (supervisor, peers, koordinator). */}
        {info && (
          <>
            <SdTasks embedded general />
            {results?.period && (
              <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[#053b50]">My scores <span className="text-sm font-semibold text-gray-700">· {results.period.name}</span></h2>
                  <a href="/self-reflection" className="text-sm font-bold text-[#006e7a] hover:underline">Fill in my self-reflection →</a>
                </div>
                {results.locked && <p className="text-sm text-[#b45309] font-semibold">Scores are hidden until they are published.</p>}
                <div className="grid sm:grid-cols-3 gap-3">
                  {results.sources.map((s: any) => (
                    <div key={s.type} className="rounded-xl border border-gray-100 p-4 text-center">
                      <div className="text-sm font-bold text-gray-700">{s.type === 'SUPERVISOR' ? 'Leader / supervisor' : s.type === 'PEER' ? 'Peers' : 'Koordinator'}</div>
                      <div className="text-3xl font-extrabold text-[#053b50] mt-1">{s.average ?? '—'}</div>
                      <div className="text-xs text-gray-700 mt-1">{s.assigned ? `${s.submitted} of ${s.assigned} submitted` : 'nobody assigned'}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-700">Scores are on a 1–4 scale; peers are shown as one average.</p>
              </section>
            )}
          </>
        )}

        {loadErr && <p className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm font-semibold">{loadErr}</p>}

        {info && info.modes.length === 0 && (
          <section className={`${card} space-y-3`}>
            <p className="text-gray-800">You do not assign evaluators.</p>
            {info.toEvaluate.length > 0 && <p><b>You evaluate:</b> {info.toEvaluate.map((x: any) => x.name).join(', ')}</p>}
            {info.evaluatedBy.length > 0 && <p><b>Evaluated by:</b> {info.evaluatedBy.map((x: any) => x.name).join(', ')}</p>}
            {info.toEvaluate.length + info.evaluatedBy.length === 0 && <p className="text-gray-700">Nothing has been assigned to you yet.</p>}
          </section>
        )}

        {info && info.modes.length > 0 && (
          <>
            <section className={`${card} space-y-3`}>
              <div className="flex flex-wrap gap-3 items-center">
                {info.modes.length > 1 ? (
                  <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                    {info.modes.map((m: Mode) => (
                      <button key={m.mode} onClick={() => setMode(m.mode)} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode === m.mode ? 'bg-[#008c99] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{m.label}</button>
                    ))}
                  </div>
                ) : <span className="font-bold text-[#053b50]">{info.modes[0].label}</span>}
                <span className="text-sm font-bold text-[#053b50]">Period</span>
                <select value={periodId} onChange={e => setPeriodId(e.target.value)} className={input}>
                  {info.periods.length === 0 && <option value="">No open period</option>}
                  {info.periods.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
                </select>
              </div>
              {info.periods.length === 0 && <p className="text-sm text-[#b45309] font-semibold">There is no open or draft evaluation period. Ask the principal or admin to create one first.</p>}
              {locked && <p className="text-sm text-red-600 font-semibold">This period is closed. Assignments are read-only.</p>}
            </section>

            {mode === 'HEAD_WORKERS' && info.headCandidates && (
              <section className={`${card} space-y-3`}>
                <h2 className="font-extrabold text-[#053b50]">Head of each division</h2>
                <p className="text-sm text-gray-700">Choose who leads each division (one of that team: IT, PR, ACC, admin, HRD or staff). The head becomes the head evaluator of that division's workers who have none yet.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {['IT', 'HRD', 'ADMIN', 'PR', 'ACC'].map(d => (
                    <label key={d} className="text-sm font-bold text-gray-800 space-y-1 block">{d}
                      <select value={info.heads?.[d] || ''} onChange={e => setHead(d, e.target.value)} disabled={!editable} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold">
                        <option value="">— not chosen —</option>
                        {(info.headCandidates[d] || []).map((p: Person) => <option key={p.id} value={p.id}>{p.name} ({pretty(p.role)})</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {headMsg && <p className={`text-sm font-semibold ${headMsg.startsWith('Head') ? 'text-green-700' : 'text-red-700'}`}>{headMsg}</p>}
              </section>
            )}

            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <button disabled={i > 0 && !sel} onClick={() => go(i)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${i === step ? 'bg-[#053b50] text-white border-[#053b50]' : i < step ? 'bg-[#e6f4f5] text-[#006e7a] border-[#008c99]' : 'bg-white text-gray-600 border-gray-200'} disabled:opacity-50`}>
                    <span className={`w-6 h-6 rounded-full grid place-items-center text-xs ${i === step ? 'bg-white text-[#053b50]' : 'bg-white/70'}`}>{i < step ? '✓' : i + 1}</span>{s.title}
                  </button>
                </li>
              ))}
            </ol>

            <section className={`${card} space-y-4`}>
              {done ? (
                <div className="text-center space-y-4 py-6">
                  <div className="text-5xl">✅</div>
                  <h2 className="text-2xl font-extrabold text-[#053b50]">Saved for {done}</h2>
                  <button className={btn} onClick={reset}>Assign another {noun}</button>
                </div>
              ) : cur.key === 'REVIEW' ? (
                <>
                  <h2 className="text-xl font-extrabold text-[#053b50]">Review: {sel?.name}</h2>
                  {roles.map(r => (
                    <div key={r} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex justify-between items-center"><b className="text-[#053b50]">{title(r)}</b><button className="text-[#006e7a] text-sm font-bold" onClick={() => go(steps.findIndex(s => s.key === r))}>Change</button></div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(draft[r] ?? []).length ? draft[r].map(id => <span key={id} className="px-3 py-1 rounded-full bg-[#e6f4f5] text-[#053b50] text-sm font-semibold">{nameOf(id)}</span>) : <span className="text-sm text-gray-600">None selected</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2">
                    <button className={ghost} onClick={() => go(step - 1)}>← Back</button>
                    {editable ? <button className={btn} disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save assignments'}</button> : <span className="text-sm text-gray-700 self-center">Read-only</span>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#053b50]">{cur.hint}</h2>
                    {cur.key !== 'PERSON' && <p className="text-sm text-gray-700">For <b>{sel?.name}</b>. Click names to select or unselect. {(draft[cur.key] ?? []).length} selected.</p>}
                  </div>
                  <input className={`${input} w-full`} placeholder="Search by name…" value={q} onChange={e => setQ(e.target.value)} autoFocus />

                  {cur.key === 'PERSON' ? (
                    <div className="grid sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto">
                      {shown.map((t: Target) => {
                        const counts = roles.map(r => `${(title(r)[0])} ${(t.assigned[r] ?? []).length}`).join(' · ');
                        const n = roles.reduce((a, r) => a + (t.assigned[r] ?? []).length, 0);
                        return (
                          <button key={t.id} onClick={() => pick(t)} className="text-left rounded-xl border border-gray-100 p-3 hover:border-[#008c99] hover:bg-[#e6f4f5] transition-all">
                            <div className="font-bold text-[#053b50]">{t.name}</div>
                            <div className="text-xs text-gray-700">{sub(t)}</div>
                            <div className="text-xs text-gray-600 mt-1">{n ? counts : 'Nobody assigned yet'}</div>
                          </button>
                        );
                      })}
                      {shown.length === 0 && <p className="text-sm text-gray-700">No {noun}s to show here yet. Check that their role, school or division is set in Users.</p>}
                    </div>
                  ) : (
                    <>
                      {(draft[cur.key] ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {draft[cur.key].map(id => (
                            <button key={id} disabled={!editable} onClick={() => toggle(cur.key, id)} className="px-3 py-1 rounded-full bg-[#008c99] text-white text-sm font-semibold">{nameOf(id)} ✕</button>
                          ))}
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto">
                        {shown.map((x: Person) => {
                          const on = (draft[cur.key] ?? []).includes(x.id);
                          const submitted = sel?.assigned[cur.key]?.some(a => a.evaluatorId === x.id && a.submitted);
                          return (
                            <button key={x.id} disabled={!editable} onClick={() => toggle(cur.key, x.id)}
                              className={`text-left rounded-xl border p-3 transition-all ${on ? 'border-[#008c99] bg-[#e6f4f5]' : 'border-gray-100 hover:bg-gray-50'} disabled:opacity-60`}>
                              <span className="font-semibold text-[#053b50]">{on ? '✓ ' : ''}{x.name}</span>
                              <span className="text-xs text-gray-700"> · {sub(x)}</span>
                              {submitted && <span className="text-xs text-green-700"> · already evaluated</span>}
                            </button>
                          );
                        })}
                        {shown.length === 0 && <p className="text-sm text-gray-700">No one can be picked for this yet. Check that their role, school or division is set in Users.</p>}
                      </div>
                    </>
                  )}

                  {cur.key !== 'PERSON' && (
                    <div className="flex justify-between pt-2">
                      <button className={ghost} onClick={() => go(step - 1)}>← Back</button>
                      <button className={btn} onClick={() => go(step + 1)}>{step === steps.length - 2 ? 'Review →' : 'Next →'}</button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className={`${card} space-y-3`}>
              <h2 className="text-lg font-extrabold text-[#053b50]">Current assignments</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-900">
                  <thead><tr className="text-left text-gray-700"><th className="py-2">{pretty(noun)}</th>{roles.map(r => <th key={r}>{title(r)}</th>)}<th /></tr></thead>
                  <tbody>
                    {targets.map(t => (
                      <tr key={t.id} className="border-t border-gray-100 align-top">
                        <td className="py-2 font-bold text-[#053b50]">{t.name}<span className="block text-xs font-normal text-gray-700">{sub(t)}</span></td>
                        {roles.map(r => <td key={r}>{(t.assigned[r] ?? []).map(x => x.name).join(', ') || <span className="text-gray-400">—</span>}</td>)}
                        <td className="text-right"><button className="text-[#006e7a] font-bold" onClick={() => { pick(t, 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{editable ? 'Edit' : 'View'}</button></td>
                      </tr>
                    ))}
                    {targets.length === 0 && <tr><td colSpan={roles.length + 2} className="py-4 text-gray-700">Nobody to show yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
