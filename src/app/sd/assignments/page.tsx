'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SdShell from '@/components/SdShell';

type Role = 'SUPERVISOR' | 'PEER' | 'KOORDINATOR';
const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: 'SUPERVISOR', label: 'Supervisor', hint: 'Additional evaluator of this teacher.' },
  { key: 'PEER', label: 'Peer', hint: 'Fellow teachers who evaluate this teacher.' },
  { key: 'KOORDINATOR', label: 'Koordinator', hint: 'Counted together with the principal / vice principal in Leaders.' },
];

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data.error || 'Something went wrong'); return null; }
  return data;
}

const STEPS = ['Teacher', 'Supervisor', 'Peers', 'Koordinator', 'Review'] as const;

export default function SdAssignmentsPage() {
  const [me, setMe] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cand, setCand] = useState<{ teachers: any[]; others: any[] }>({ teachers: [], others: [] });
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [perms, setPerms] = useState<any>(null);
  const [newPeriod, setNewPeriod] = useState('');

  const [step, setStep] = useState(0);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Role, string[]>>({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] });
  const [search, setSearch] = useState('');
  const [fromDb, setFromDb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const period = periods.find(p => p.id === periodId);
  const locked = period?.status === 'CLOSED';
  const isPrincipal = me?.role === 'PRINCIPAL';
  const may = (p: 'supervisors' | 'periods') => isPrincipal || (me?.role === 'ADMIN' && perms?.adminSd?.[p]);
  const canAssign = may('supervisors') && !locked;

  const loadPeriods = useCallback(async () => {
    const ps = await (await fetch('/api/sd/periods')).json();
    if (Array.isArray(ps)) { setPeriods(ps); setPeriodId(cur => cur || ps.find((p: any) => p.status === 'OPEN')?.id || ps[0]?.id || ''); }
  }, []);
  const loadData = useCallback(async (id: string) => {
    if (!id) return;
    const [a, pr] = await Promise.all([fetch(`/api/sd/assignments?periodId=${id}`), fetch(`/api/sd/evaluations?periodId=${id}`)]);
    if (a.ok) setTeachers((await a.json()).teachers ?? []);
    if (pr.ok) setProgress(Object.fromEntries((await pr.json()).map((r: any) => [r.teacherId, r])));
  }, []);
  const loadCandidates = useCallback(async () => { const t = await fetch('/api/sd/teachers'); if (t.ok) setCand(await t.json()); }, []);

  useEffect(() => { (async () => {
    setMe(await (await fetch('/api/me')).json());
    loadPeriods(); loadCandidates();
    const p = await fetch('/api/sd/permissions'); if (p.ok) setPerms(await p.json());
  })(); }, [loadPeriods, loadCandidates]);
  useEffect(() => { loadData(periodId); restart(); }, [periodId, loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  const teacher = teachers.find(t => t.id === teacherId);
  const nameOf = (id: string) => [...cand.teachers, ...teachers, ...cand.others].find(x => x.id === id)?.name ?? '…';

  function restart() { setStep(0); setTeacherId(null); setSearch(''); setFromDb(false); setDone(false); setDraft({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] }); }
  const pickTeacher = (t: any) => {
    setTeacherId(t.id);
    setDraft({ SUPERVISOR: t.SUPERVISOR.map((x: any) => x.evaluatorId), PEER: t.PEER.map((x: any) => x.evaluatorId), KOORDINATOR: t.KOORDINATOR.map((x: any) => x.evaluatorId) });
    setSearch(''); setFromDb(false); setStep(1);
  };
  const go = (n: number) => { setStep(n); setSearch(''); setFromDb(false); };
  const toggle = (role: Role, id: string) => setDraft(d => ({ ...d, [role]: d[role].includes(id) ? d[role].filter(x => x !== id) : [...d[role], id] }));

  const addFromDb = async (u: any) => {
    const r = await call('/api/sd/teachers', 'POST', { userId: u.id });
    if (r) { await Promise.all([loadCandidates(), loadData(periodId)]); setFromDb(false); setSearch(''); }
  };

  const changedRoles = teacher ? ROLES.filter(r => JSON.stringify([...draft[r.key]].sort()) !== JSON.stringify(teacher[r.key].map((x: any) => x.evaluatorId).sort())) : [];
  const saveAll = async () => {
    if (!teacher) return;
    setSaving(true);
    for (const r of changedRoles) {
      const ok = await call('/api/sd/assignments', 'PUT', { periodId, teacherId: teacher.id, role: r.key, evaluatorIds: draft[r.key] });
      if (!ok) { setSaving(false); return; }
    }
    setSaving(false); setDone(true); loadData(periodId);
  };

  const q = search.trim().toLowerCase();
  const input = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
  const btn = 'px-5 py-2.5 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';
  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';

  // Step 1 list: teachers; steps 2-4: teachers except the one being evaluated
  const pool = (step === 1 || step === 2 || step === 3 ? cand.teachers.filter(x => x.id !== teacherId) : cand.teachers).filter(x => !q || x.name.toLowerCase().includes(q));
  const dbPool = cand.others.filter(x => !q || x.name.toLowerCase().includes(q));
  const roleOfStep = step === 1 ? 'SUPERVISOR' : step === 2 ? 'PEER' : step === 3 ? 'KOORDINATOR' : null;
  const roleInfo = ROLES.find(r => r.key === roleOfStep);
  const taken = (id: string) => ROLES.filter(r => r.key !== roleOfStep && draft[r.key].includes(id)).map(r => r.label);

  const AddFromDb = () => (
    <div className="border-t pt-3 mt-1">
      {!fromDb ? (
        <button className="text-sm font-bold text-[#008c99] hover:underline" onClick={() => setFromDb(true)}>+ Teacher not in the list? Add from the database</button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Teacher accounts that have no school yet. Choosing one makes them a {isPrincipal ? 'TK / SD' : 'SD'} teacher.</p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {dbPool.map(u => <button key={u.id} onClick={() => addFromDb(u)} className="px-3 py-1.5 rounded-full border border-dashed border-[#008c99] text-sm text-[#008c99] font-semibold hover:bg-[#e6f4f5]">+ {u.name}</button>)}
            {dbPool.length === 0 && <p className="text-sm text-gray-400">No teacher without a school was found.</p>}
          </div>
          <button className="text-xs text-gray-500 underline" onClick={() => setFromDb(false)}>Close</button>
        </div>
      )}
    </div>
  );

  return (
    <SdShell title="Assign Evaluators" subtitle="Step by step: choose the teacher, then who supervises, who is a peer and who is the koordinator.">
      <section className={`${card} space-y-3`}>
        <h2 className="text-lg font-extrabold text-[#053b50]">Evaluation period</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={input} value={periodId} onChange={e => setPeriodId(e.target.value)}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
          </select>
          {period?.status === 'DRAFT' && may('periods') && <button className={btn} onClick={async () => { if (confirm('Open this period? Evaluations can then be submitted.') && await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'OPEN' })) loadPeriods(); }}>Open period</button>}
          {period?.status === 'OPEN' && may('periods') && <button className={btn} onClick={async () => { if (confirm('Close this period? Assignments become read-only.') && await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'CLOSED' })) loadPeriods(); }}>Close period</button>}
          {may('periods') && (<>
            <input className={input} placeholder="New period, e.g. 2026/2027 Semester 1" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} />
            <button className={btn} disabled={!newPeriod.trim()} onClick={async () => { if (await call('/api/sd/periods', 'POST', { name: newPeriod })) { setNewPeriod(''); loadPeriods(); } }}>Add period</button>
          </>)}
        </div>
        {isPrincipal && perms && (
          <div className="text-sm border-t pt-3">
            <p className="font-semibold mb-1">What Admin SD may do</p>
            {(['supervisors', 'periods'] as const).map(k => (
              <label key={k} className="mr-5 inline-flex items-center gap-2">
                <input type="checkbox" checked={!!perms.adminSd[k]} onChange={async e => { if (await call('/api/sd/permissions', 'PUT', { permission: k, value: e.target.checked })) setPerms({ ...perms, adminSd: { ...perms.adminSd, [k]: e.target.checked } }); }} />
                {k === 'supervisors' ? 'Assign evaluators' : 'Open / close periods'}
              </label>
            ))}
          </div>
        )}
      </section>

      {period && (
        <section className={`${card} space-y-6`}>
          {/* Stepper */}
          <ol className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <button
                  disabled={i > 0 && !teacherId}
                  onClick={() => go(i)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${i === step ? 'bg-[#008c99] border-[#008c99] text-white' : i < step ? 'bg-[#e6f4f5] border-[#008c99] text-[#008c99]' : 'border-gray-200 text-gray-400'}`}
                >{i < step ? '✓' : i + 1}</button>
                <span className={i === step ? 'text-[#053b50]' : 'text-gray-400'}>{label}</span>
                {i < STEPS.length - 1 && <span className="w-6 h-0.5 bg-gray-200 hidden sm:block" />}
              </li>
            ))}
          </ol>

          {/* Step 1: teacher */}
          {step === 0 && (
            <div className="space-y-3">
              <div><h3 className="text-xl font-extrabold text-[#053b50]">Who will be evaluated?</h3><p className="text-sm text-gray-500">Click a teacher to continue.</p></div>
              <input className={`${input} w-full sm:w-72`} placeholder="Search teacher…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto">
                {teachers.filter(t => !q || t.name.toLowerCase().includes(q)).map(t => {
                  const p = progress[t.id];
                  const n = (k: Role) => t[k].length;
                  return (
                    <button key={t.id} onClick={() => pickTeacher(t)} className="text-left rounded-xl border border-gray-100 p-3 hover:border-[#008c99] hover:bg-[#e6f4f5] transition-all">
                      <div className="font-bold text-[#053b50]">{t.name}{t.className ? <span className="text-gray-400 font-normal"> · {t.className}</span> : null}</div>
                      <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className={n('SUPERVISOR') ? 'text-green-700' : 'text-gray-400'}>Supervisor {n('SUPERVISOR')}</span>
                        <span className={n('PEER') ? 'text-green-700' : 'text-gray-400'}>Peer {n('PEER')}</span>
                        <span className={n('KOORDINATOR') ? 'text-green-700' : 'text-gray-400'}>Koordinator {n('KOORDINATOR')}</span>
                        {p && <span className="text-gray-500">· submitted {p.supervisor.submitted + p.peer.submitted + p.koordinator.submitted}</span>}
                      </div>
                    </button>
                  );
                })}
                {teachers.length === 0 && <p className="text-sm text-gray-400">No TK / SD teachers yet. Add one from the database below.</p>}
              </div>
              {canAssign && <AddFromDb />}
            </div>
          )}

          {/* Steps 2-4: pick evaluators for one role */}
          {roleInfo && teacher && (
            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-extrabold text-[#053b50]">Who is the {roleInfo.label.toLowerCase()} of {teacher.name}?</h3>
                <p className="text-sm text-gray-500">{roleInfo.hint} Click names to select or unselect. {draft[roleInfo.key].length} selected.</p>
              </div>
              {draft[roleInfo.key].length > 0 && (
                <div className="flex flex-wrap gap-2">{draft[roleInfo.key].map(id => <span key={id} className="px-3 py-1 rounded-full bg-[#008c99] text-white text-sm font-semibold">{nameOf(id)}</span>)}</div>
              )}
              <input className={`${input} w-full sm:w-72`} placeholder="Search teacher…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex flex-wrap gap-2 max-h-[45vh] overflow-y-auto">
                {pool.map(x => {
                  const on = draft[roleInfo.key].includes(x.id);
                  const other = taken(x.id);
                  return (
                    <button key={x.id} type="button" disabled={!canAssign} onClick={() => toggle(roleInfo.key, x.id)}
                      className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${on ? 'bg-[#008c99] text-white border-[#008c99]' : 'bg-white text-[#053b50] border-gray-200 hover:border-[#008c99]'} ${!canAssign ? 'opacity-60' : ''}`}>
                      {on ? '✓ ' : ''}{x.name}{other.length ? <span className={`ml-1 text-xs font-normal ${on ? 'text-white/80' : 'text-gray-400'}`}>({other.join(', ')})</span> : null}
                    </button>
                  );
                })}
                {pool.length === 0 && <p className="text-sm text-gray-400">No teacher found.</p>}
              </div>
              {canAssign && <AddFromDb />}
            </div>
          )}

          {/* Step 5: review */}
          {step === 4 && teacher && !done && (
            <div className="space-y-4">
              <h3 className="text-xl font-extrabold text-[#053b50]">Check and save</h3>
              <p className="text-sm text-gray-600">Evaluated teacher: <b>{teacher.name}</b></p>
              {ROLES.map(r => (
                <div key={r.key} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex justify-between"><b className="text-[#053b50]">{r.label}</b><button className="text-xs text-[#008c99] font-bold" onClick={() => go(r.key === 'SUPERVISOR' ? 1 : r.key === 'PEER' ? 2 : 3)}>Change</button></div>
                  <div className="text-sm mt-1">{draft[r.key].length ? draft[r.key].map(nameOf).join(', ') : <span className="text-gray-400">nobody</span>}</div>
                </div>
              ))}
              {changedRoles.length === 0 && <p className="text-sm text-gray-500">Nothing changed.</p>}
            </div>
          )}
          {step === 4 && done && (
            <div className="space-y-3 text-center py-6">
              <div className="text-4xl">✅</div>
              <h3 className="text-xl font-extrabold text-[#053b50]">Saved for {teacher?.name}</h3>
              <button className={btn} onClick={restart}>Assign another teacher</button>
            </div>
          )}

          {/* Navigation */}
          {!(step === 4 && done) && (
            <div className="flex justify-between border-t pt-4">
              <button className={ghost} disabled={step === 0} onClick={() => go(step - 1)}>← Back</button>
              {step >= 1 && step <= 3 && <button className={btn} onClick={() => go(step + 1)}>Next →</button>}
              {step === 4 && canAssign && <button className={btn} disabled={saving || changedRoles.length === 0} onClick={saveAll}>{saving ? 'Saving…' : 'Save'}</button>}
            </div>
          )}
          {locked && <p className="text-sm text-amber-700">This period is closed, so assignments are read-only.</p>}
        </section>
      )}
    </SdShell>
  );
}
