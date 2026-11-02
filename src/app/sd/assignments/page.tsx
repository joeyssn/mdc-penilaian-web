'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SdShell from '@/components/SdShell';

type Role = 'SUPERVISOR' | 'PEER' | 'KOORDINATOR';
const STEPS: { key: 'TEACHER' | Role | 'REVIEW'; title: string; hint: string }[] = [
  { key: 'TEACHER', title: 'Teacher', hint: 'Who is being evaluated?' },
  { key: 'SUPERVISOR', title: 'Supervisor', hint: 'Who supervises this teacher?' },
  { key: 'PEER', title: 'Peers', hint: 'Who evaluates this teacher as a peer? Teachers, staff and others.' },
  { key: 'KOORDINATOR', title: 'Koordinator', hint: 'Who is the koordinator?' },
  { key: 'REVIEW', title: 'Review', hint: 'Check and save.' },
];
const LABEL: Record<Role, string> = { SUPERVISOR: 'Supervisor', PEER: 'Peers', KOORDINATOR: 'Koordinator' };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data.error || 'Something went wrong'); return null; }
  return data;
}

export default function SdAssignmentsPage() {
  const [me, setMe] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cand, setCand] = useState<{ teachers: any[]; leaders: any[]; peers: any[] }>({ teachers: [], leaders: [], peers: [] });
  const [perms, setPerms] = useState<any>(null);
  const [newPeriod, setNewPeriod] = useState('');
  const [step, setStep] = useState(0);
  const [teacherId, setTeacherId] = useState('');
  const [draft, setDraft] = useState<Record<Role, string[]>>({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] });
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const period = periods.find(p => p.id === periodId);
  const locked = period?.status === 'CLOSED';
  const isPrincipal = me?.role === 'PRINCIPAL';
  const canAssign = isPrincipal || me?.role === 'ADMIN';
  const canPeriods = isPrincipal || (me?.role === 'ADMIN' && perms?.adminSd?.periods);

  const loadPeriods = useCallback(async () => {
    const ps = await (await fetch('/api/sd/periods')).json();
    if (Array.isArray(ps)) { setPeriods(ps); setPeriodId(cur => cur || ps.find((p: any) => p.status === 'OPEN')?.id || ps[0]?.id || ''); }
  }, []);
  const loadTeachers = useCallback(async (id: string) => {
    if (!id) return;
    const a = await fetch(`/api/sd/assignments?periodId=${id}`);
    if (a.ok) setTeachers((await a.json()).teachers ?? []);
  }, []);

  useEffect(() => { (async () => {
    setMe(await (await fetch('/api/me')).json());
    loadPeriods();
    const t = await fetch('/api/sd/teachers'); if (t.ok) setCand(await t.json());
    const p = await fetch('/api/sd/permissions'); if (p.ok) setPerms(await p.json());
  })(); }, [loadPeriods]);
  useEffect(() => { loadTeachers(periodId); reset(); }, [periodId, loadTeachers]); // eslint-disable-line react-hooks/exhaustive-deps

  const teacher = teachers.find(t => t.id === teacherId);
  const nameOf = (id: string) => [...cand.leaders, ...cand.teachers, ...(cand.peers ?? [])].find(x => x.id === id)?.name ?? '(unknown)';

  function reset() { setStep(0); setTeacherId(''); setDraft({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] }); setQ(''); setDone(null); }
  function pick(t: any, goto = 1) {
    setTeacherId(t.id); setQ(''); setDone(null);
    setDraft({ SUPERVISOR: t.SUPERVISOR.map((x: any) => x.evaluatorId), PEER: t.PEER.map((x: any) => x.evaluatorId), KOORDINATOR: t.KOORDINATOR.map((x: any) => x.evaluatorId) });
    setStep(goto);
  }
  const go = (n: number) => { setStep(n); setQ(''); };
  const toggle = (role: Role, id: string) => setDraft(d => ({ ...d, [role]: d[role].includes(id) ? d[role].filter(x => x !== id) : [...d[role], id] }));

  async function saveAll() {
    if (!teacher) return;
    setSaving(true);
    for (const role of ['SUPERVISOR', 'PEER', 'KOORDINATOR'] as Role[]) {
      const same = JSON.stringify([...draft[role]].sort()) === JSON.stringify(teacher[role].map((x: any) => x.evaluatorId).sort());
      if (same) continue;
      const r = await call('/api/sd/assignments', 'PUT', { periodId, teacherId: teacher.id, role, evaluatorIds: draft[role] });
      if (!r) { setSaving(false); return; }
    }
    setSaving(false);
    await loadTeachers(periodId);
    setDone(teacher.name);
  }

  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';
  const btn = 'px-5 py-3 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-5 py-3 rounded-xl text-sm font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';
  const input = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
  const cur = STEPS[step];
  const editable = canAssign && !locked;

  const pool = useMemo(() => {
    if (cur.key === 'TEACHER') return teachers;
    const base = cur.key === 'PEER' ? (cand.peers ?? cand.teachers) : cand.leaders;
    return base.filter((x: any) => x.id !== teacherId);
  }, [cur.key, teachers, cand, teacherId]);
  const shown = pool;

  return (
    <SdShell title="Assign Evaluators" subtitle="Follow the steps: pick a teacher, then who supervises, who is a peer, and who is the koordinator.">
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-bold text-[#053b50]">Period</span>
          <select className={input} value={periodId} onChange={e => setPeriodId(e.target.value)}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
          </select>
          {period?.status === 'DRAFT' && canPeriods && <button className="px-3 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white" onClick={async () => { if (confirm('Open this period? Evaluations can then be submitted.') && await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'OPEN' })) loadPeriods(); }}>Open</button>}
          {period?.status === 'OPEN' && canPeriods && <button className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200" onClick={async () => { if (confirm('Close this period? Assignments become read-only.') && await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'CLOSED' })) loadPeriods(); }}>Close</button>}
          {canPeriods && (<>
            <input className={input} placeholder="New period name" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} />
            <button className="px-3 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white disabled:opacity-40" disabled={!newPeriod.trim()} onClick={async () => { if (await call('/api/sd/periods', 'POST', { name: newPeriod })) { setNewPeriod(''); loadPeriods(); } }}>Add</button>
          </>)}
        </div>
        {isPrincipal && perms && (
          <label className="text-sm inline-flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={!!perms.adminSd?.periods} onChange={async e => { if (await call('/api/sd/permissions', 'PUT', { permission: 'periods', value: e.target.checked })) setPerms({ ...perms, adminSd: { ...perms.adminSd, periods: e.target.checked } }); }} />
            Let Admin SD open and close periods
          </label>
        )}
        {!canAssign && <p className="text-sm text-gray-500">You can view the assignments but not change them.</p>}
        {locked && <p className="text-sm text-red-600 font-semibold">This period is closed. Assignments are read-only.</p>}
      </section>

      {period && (
        <>
          {/* Stepper */}
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button disabled={i > 0 && !teacherId} onClick={() => go(i)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${i === step ? 'bg-[#053b50] text-white border-[#053b50]' : i < step ? 'bg-[#e6f4f5] text-[#008c99] border-[#008c99]' : 'bg-white text-gray-400 border-gray-200'} disabled:opacity-50`}>
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
                <div className="flex justify-center gap-3"><button className={btn} onClick={reset}>Assign another teacher</button></div>
              </div>
            ) : cur.key === 'REVIEW' ? (
              <>
                <h2 className="text-xl font-extrabold text-[#053b50]">Review: {teacher?.name}</h2>
                {(['SUPERVISOR', 'PEER', 'KOORDINATOR'] as Role[]).map(r => (
                  <div key={r} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex justify-between items-center"><b className="text-[#053b50]">{LABEL[r]}</b><button className="text-[#008c99] text-sm font-bold" onClick={() => go(STEPS.findIndex(s => s.key === r))}>Change</button></div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {draft[r].length ? draft[r].map(id => <span key={id} className="px-3 py-1 rounded-full bg-[#e6f4f5] text-[#053b50] text-sm font-semibold">{nameOf(id)}</span>) : <span className="text-sm text-gray-400">None selected</span>}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <button className={ghost} onClick={() => go(step - 1)}>← Back</button>
                  {editable ? <button className={btn} disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save assignments'}</button> : <span className="text-sm text-gray-500 self-center">Read-only</span>}
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-extrabold text-[#053b50]">{cur.hint}</h2>
                  {cur.key !== 'TEACHER' && <p className="text-sm text-gray-500">For <b>{teacher?.name}</b>. Click names to select or unselect. {draft[cur.key as Role].length} selected.</p>}
                </div>

                {cur.key === 'TEACHER' ? (
                  <div className="grid sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto">
                    {shown.map((t: any) => {
                      const n = t.SUPERVISOR.length + t.PEER.length + t.KOORDINATOR.length;
                      return (
                        <button key={t.id} onClick={() => pick(t)} className="text-left rounded-xl border border-gray-100 p-3 hover:border-[#008c99] hover:bg-[#e6f4f5] transition-all">
                          <div className="font-bold text-[#053b50]">{t.name}{t.className ? <span className="text-gray-400 font-normal"> · {t.className}</span> : null}</div>
                          {n ? (['SUPERVISOR', 'PEER', 'KOORDINATOR'] as const).filter(r => t[r].length > 0).map(r => (
                            <div key={r} className="text-xs text-gray-700 mt-1"><b>{r === 'SUPERVISOR' ? 'Supervisor' : r === 'PEER' ? 'Peers' : 'Koordinator'}:</b> {t[r].map((a: any) => a.name).join(', ')}</div>
                          )) : <div className="text-xs text-gray-500 mt-1">Nobody assigned yet</div>}
                        </button>
                      );
                    })}
                    {shown.length === 0 && <p className="text-sm text-gray-400">No {String(me?.level || 'TK / SD').toUpperCase()} teachers found.</p>}
                  </div>
                ) : (
                  <>
                    {draft[cur.key as Role].length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {draft[cur.key as Role].map(id => (
                          <button key={id} disabled={!editable} onClick={() => toggle(cur.key as Role, id)} className="px-3 py-1 rounded-full bg-[#008c99] text-white text-sm font-semibold">{nameOf(id)} ✕</button>
                        ))}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto">
                      {shown.map((x: any) => {
                        const on = draft[cur.key as Role].includes(x.id);
                        const submitted = teacher?.[cur.key as Role]?.some((a: any) => a.evaluatorId === x.id && a.submitted);
                        return (
                          <button key={x.id} disabled={!editable} onClick={() => toggle(cur.key as Role, x.id)}
                            className={`text-left rounded-xl border p-3 transition-all ${on ? 'border-[#008c99] bg-[#e6f4f5]' : 'border-gray-100 hover:bg-gray-50'} disabled:opacity-60`}>
                            <span className="font-semibold text-[#053b50]">{on ? '✓ ' : ''}{x.name}</span>
                            {x.role && x.role !== 'TEACHER' && <span className="text-xs text-gray-400"> · {String(x.role).replace('VICE_PRINCIPAL_', 'wakasek ').toLowerCase()}</span>}
                            {x.role && x.role !== 'TEACHER' && <span className="text-xs text-gray-400"> · {String(x.role).replace('VICE_PRINCIPAL_', 'Wakasek ').toLowerCase()}</span>}
                            {submitted && <span className="text-xs text-green-600"> · already evaluated</span>}
                          </button>
                        );
                      })}
                      {shown.length === 0 && <p className="text-sm text-gray-400">No one found.</p>}
                    </div>
                  </>
                )}

                {cur.key !== 'TEACHER' && (
                  <div className="flex justify-between pt-2">
                    <button className={ghost} onClick={() => go(step - 1)}>← Back</button>
                    <button className={btn} onClick={() => go(step + 1)}>{cur.key === 'KOORDINATOR' ? 'Review →' : 'Next →'}</button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Overview: click Edit to jump into the steps */}
          <section className={`${card} space-y-3`}>
            <h2 className="text-lg font-extrabold text-[#053b50]">Current assignments</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="py-2">Teacher</th><th>Supervisor</th><th>Peers</th><th>Koordinator</th><th /></tr></thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} className="border-t border-gray-100 align-top">
                      <td className="py-2 font-bold text-[#053b50]">{t.name}</td>
                      <td>{t.SUPERVISOR.map((x: any) => x.name).join(', ') || <span className="text-gray-300">—</span>}</td>
                      <td>{t.PEER.map((x: any) => x.name).join(', ') || <span className="text-gray-300">—</span>}</td>
                      <td>{t.KOORDINATOR.map((x: any) => x.name).join(', ') || <span className="text-gray-300">—</span>}</td>
                      <td className="text-right"><button className="text-[#008c99] font-bold" onClick={() => { pick(t, 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{editable ? 'Edit' : 'View'}</button></td>
                    </tr>
                  ))}
                  {teachers.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No {String(me?.level || 'TK / SD').toUpperCase()} teachers yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </SdShell>
  );
}
