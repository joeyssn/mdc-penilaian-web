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

export default function SdAssignmentsPage() {
  const [me, setMe] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cand, setCand] = useState<{ teachers: any[]; leaders: any[] }>({ teachers: [], leaders: [] });
  const [perms, setPerms] = useState<any>(null);
  const [newPeriod, setNewPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);              // 0 teacher, 1 supervisor, 2 peer, 3 koordinator, 4 review
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Role, string[]>>({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] });
  const [find, setFind] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const period = periods.find(p => p.id === periodId);
  const locked = period?.status === 'CLOSED';
  const isPrincipal = me?.role === 'PRINCIPAL';
  const may = (p: 'supervisors' | 'periods') => isPrincipal || (me?.role === 'ADMIN' && perms?.adminSd?.[p]);
  const canEdit = may('supervisors') && !locked;

  const loadPeriods = useCallback(async () => {
    const ps = await (await fetch('/api/sd/periods')).json();
    if (Array.isArray(ps)) { setPeriods(ps); setPeriodId(cur => cur || ps.find((p: any) => p.status === 'OPEN')?.id || ps[0]?.id || ''); }
  }, []);
  const loadData = useCallback(async (id: string) => {
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
  useEffect(() => { loadData(periodId); setStep(0); setTeacherId(null); }, [periodId, loadData]);

  const teacher = teachers.find(t => t.id === teacherId);
  const chooseTeacher = (t: any) => {
    setTeacherId(t.id); setNotice(''); setFind('');
    setDraft({ SUPERVISOR: t.SUPERVISOR.map((x: any) => x.evaluatorId), PEER: t.PEER.map((x: any) => x.evaluatorId), KOORDINATOR: t.KOORDINATOR.map((x: any) => x.evaluatorId) });
    setStep(1);
  };
  const go = (n: number) => { setFind(''); setStep(n); };
  const toggle = (role: Role, id: string) => setDraft(d => ({ ...d, [role]: d[role].includes(id) ? d[role].filter(x => x !== id) : [...d[role], id] }));
  const nameOf = (id: string) => [...cand.leaders, ...cand.teachers].find(x => x.id === id)?.name ?? '—';

  const saveAll = async () => {
    if (!teacher) return;
    setSaving(true);
    for (const r of ROLES) {
      const now = teacher[r.key].map((x: any) => x.evaluatorId).sort().join(',');
      if (now === [...draft[r.key]].sort().join(',')) continue;       // unchanged
      const res = await call('/api/sd/assignments', 'PUT', { periodId, teacherId: teacher.id, role: r.key, evaluatorIds: draft[r.key] });
      if (!res) { setSaving(false); return; }
    }
    setSaving(false);
    setNotice(`Saved for ${teacher.name}.`);
    await loadData(periodId);
    setTeacherId(null); setStep(0);
  };

  const list = useMemo(() => teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase())), [teachers, search]);
  const input = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
  const btn = 'px-5 py-2.5 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';
  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';
  const STEPS = ['Teacher', 'Supervisor', 'Peer', 'Koordinator', 'Review'];
  const role = step >= 1 && step <= 3 ? ROLES[step - 1] : null;
  const done = (t: any) => t.SUPERVISOR.length > 0 && t.PEER.length > 0 && t.KOORDINATOR.length > 0;

  return (
    <SdShell title="Assign Evaluators" subtitle="Follow the steps: pick a teacher, then click the people who evaluate them.">
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
          {/* Step bar */}
          <ol className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {STEPS.map((label, i) => {
              const reachable = i === 0 || !!teacher;
              return (
                <li key={label} className="flex items-center gap-2">
                  <button disabled={!reachable} onClick={() => go(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${step === i ? 'bg-[#008c99] text-white border-[#008c99]' : i < step ? 'bg-[#e6f4f5] text-[#008c99] border-[#008c99]' : 'bg-white text-gray-400 border-gray-200'} disabled:cursor-not-allowed`}>
                    <span className="w-5 h-5 rounded-full bg-white/30 text-xs flex items-center justify-center">{i < step ? '✓' : i + 1}</span>{label}
                  </button>
                  {i < STEPS.length - 1 && <span className="text-gray-300">›</span>}
                </li>
              );
            })}
          </ol>

          {notice && step === 0 && <p className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">✓ {notice}</p>}

          {/* Step 0: teacher */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="text-xl font-extrabold text-[#053b50]">1. Click a teacher</h3><p className="text-sm text-gray-500">A green tick means supervisor, peer and koordinator are all set.</p></div>
                <input className={`${input} w-56`} placeholder="Search teacher…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map(t => (
                  <button key={t.id} onClick={() => chooseTeacher(t)} className="text-left rounded-2xl border border-gray-200 p-4 hover:border-[#008c99] hover:bg-[#e6f4f5] transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-[#053b50]">{t.name}</span>
                      {done(t) && <span className="text-green-600 font-bold">✓</span>}
                    </div>
                    {t.className && <div className="text-xs text-gray-400">Class {t.className}</div>}
                    <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-3">
                      <span>Supervisor {t.SUPERVISOR.length}</span><span>Peer {t.PEER.length}</span><span>Koordinator {t.KOORDINATOR.length}</span>
                    </div>
                  </button>
                ))}
                {list.length === 0 && <p className="text-sm text-gray-400">No SD / TK teachers found.</p>}
              </div>
            </div>
          )}

          {/* Steps 1-3: pick people */}
          {role && teacher && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold text-[#053b50]">{step + 1}. Who is the {role.label.toLowerCase()} of {teacher.name}?</h3>
                  <p className="text-sm text-gray-500">{role.hint} Click names to select or unselect. {draft[role.key].length} selected.</p>
                </div>
                <input className={`${input} w-56`} placeholder={`Search…`} value={find} onChange={e => setFind(e.target.value)} />
              </div>
              {!canEdit && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{locked ? 'This period is closed.' : 'You can view but not change assignments.'}</p>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(role.key === 'PEER' ? cand.teachers : cand.leaders).filter(x => x.id !== teacher.id && x.name.toLowerCase().includes(find.toLowerCase())).map(x => {
                  const on = draft[role.key].includes(x.id);
                  const submitted = teacher[role.key].some((e: any) => e.evaluatorId === x.id && e.submitted);
                  return (
                    <button key={x.id} disabled={!canEdit} onClick={() => toggle(role.key, x.id)} className={`flex items-center justify-between gap-2 text-left rounded-xl border px-4 py-3 transition-all ${on ? 'bg-[#008c99] text-white border-[#008c99]' : 'bg-white border-gray-200 hover:border-[#008c99]'} disabled:opacity-60`}>
                      <span className="font-bold">{x.name}</span>
                      <span className="text-sm">{submitted ? 'submitted ' : ''}{on ? '✓' : ''}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button className={ghost} onClick={() => go(step - 1)}>← Back</button>
                <div className="flex gap-2">
                  {draft[role.key].length === 0 && <button className={ghost} onClick={() => go(step + 1)}>Skip</button>}
                  <button className={btn} onClick={() => go(step + 1)}>Next →</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: review */}
          {step === 4 && teacher && (
            <div className="space-y-4">
              <div><h3 className="text-xl font-extrabold text-[#053b50]">5. Check and save</h3><p className="text-sm text-gray-500">Evaluators for <b>{teacher.name}</b> in {period.name}.</p></div>
              <div className="grid md:grid-cols-3 gap-3">
                {ROLES.map((r, i) => (
                  <div key={r.key} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between"><b className="text-[#053b50]">{r.label}</b><button className="text-xs text-[#008c99] font-bold" onClick={() => go(i + 1)}>Change</button></div>
                    <ul className="mt-2 text-sm space-y-1">
                      {draft[r.key].map(id => <li key={id}>• {nameOf(id)}</li>)}
                      {draft[r.key].length === 0 && <li className="text-gray-400">nobody</li>}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button className={ghost} onClick={() => go(3)}>← Back</button>
                {canEdit ? <button className={btn} disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save and finish'}</button> : <button className={ghost} onClick={() => { setTeacherId(null); setStep(0); }}>Close</button>}
              </div>
            </div>
          )}
        </section>
      )}
    </SdShell>
  );
}
