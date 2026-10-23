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
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [perms, setPerms] = useState<any>(null);
  const [newPeriod, setNewPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Role, string[]>>({ SUPERVISOR: [], PEER: [], KOORDINATOR: [] });
  const [findPerson, setFindPerson] = useState<Record<Role, string>>({ SUPERVISOR: '', PEER: '', KOORDINATOR: '' });
  const [saving, setSaving] = useState<Role | null>(null);

  const period = periods.find(p => p.id === periodId);
  const locked = period?.status === 'CLOSED';
  const isPrincipal = me?.role === 'PRINCIPAL';
  const may = (p: 'supervisors' | 'periods') => isPrincipal || (me?.role === 'ADMIN' && perms?.adminSd?.[p]);

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

  useEffect(() => { (async () => {
    setMe(await (await fetch('/api/me')).json());
    loadPeriods();
    const t = await fetch('/api/sd/teachers'); if (t.ok) setCand(await t.json());
    const p = await fetch('/api/sd/permissions'); if (p.ok) setPerms(await p.json());
  })(); }, [loadPeriods]);
  useEffect(() => { loadData(periodId); setOpenId(null); }, [periodId, loadData]);

  const open = teachers.find(t => t.id === openId);
  const choose = (t: any) => {
    setOpenId(t.id);
    setDraft({ SUPERVISOR: t.SUPERVISOR.map((x: any) => x.evaluatorId), PEER: t.PEER.map((x: any) => x.evaluatorId), KOORDINATOR: t.KOORDINATOR.map((x: any) => x.evaluatorId) });
  };
  const save = async (role: Role) => {
    if (!open) return;
    setSaving(role);
    const r = await call('/api/sd/assignments', 'PUT', { periodId, teacherId: open.id, role, evaluatorIds: draft[role] });
    setSaving(null);
    if (r) loadData(periodId);
  };
  const toggle = (role: Role, id: string) => setDraft(d => ({ ...d, [role]: d[role].includes(id) ? d[role].filter(x => x !== id) : [...d[role], id] }));

  const list = useMemo(() => teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase())), [teachers, search]);
  const input = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white';
  const btn = 'px-4 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';
  const stat = (p?: any) => (p ? `${p.submitted}/${p.assigned}` : '0/0');

  return (
    <SdShell title="Assign Evaluators" subtitle="Click a teacher, then choose their supervisor, peers and koordinator.">
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
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <section className={`${card} lg:col-span-2 space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-[#053b50]">Teachers ({list.length})</h2>
              <input className={`${input} w-40`} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {list.map(t => {
                const p = progress[t.id];
                return (
                  <button key={t.id} onClick={() => choose(t)} className={`w-full text-left rounded-xl border p-3 transition-all ${openId === t.id ? 'border-[#008c99] bg-[#e6f4f5]' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <div className="font-bold text-[#053b50]">{t.name}{t.className ? <span className="text-gray-400 font-normal"> · {t.className}</span> : null}</div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3">
                      <span>Supervisor {stat(p?.supervisor)}</span><span>Peer {stat(p?.peer)}</span><span>Koordinator {stat(p?.koordinator)}</span><span>Siswa {stat(p?.student)}</span>
                    </div>
                  </button>
                );
              })}
              {list.length === 0 && <p className="text-sm text-gray-400">No SD / TK teachers found.</p>}
            </div>
          </section>

          <section className="lg:col-span-3 space-y-4">
            {!open && <div className={`${card} text-gray-500 text-sm`}>Pick a teacher on the left.</div>}
            {open && ROLES.map(r => {
              const pool = (r.key === 'PEER' ? cand.teachers : cand.leaders).filter(x => x.id !== open.id && x.name.toLowerCase().includes(findPerson[r.key].toLowerCase()));
              const submitted = new Set(open[r.key].filter((x: any) => x.submitted).map((x: any) => x.evaluatorId));
              const dirty = JSON.stringify([...draft[r.key]].sort()) !== JSON.stringify(open[r.key].map((x: any) => x.evaluatorId).sort());
              return (
                <div key={r.key} className={`${card} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><h3 className="text-lg font-extrabold text-[#053b50]">{r.label} of {open.name}</h3><p className="text-xs text-gray-500">{r.hint} · {draft[r.key].length} selected</p></div>
                    {may('supervisors') && !locked && <button className={btn} disabled={!dirty || saving === r.key} onClick={() => save(r.key)}>{saving === r.key ? 'Saving…' : 'Save'}</button>}
                  </div>
                  <input className={`${input} w-full`} placeholder={`Search ${r.label.toLowerCase()}…`} value={findPerson[r.key]} onChange={e => setFindPerson({ ...findPerson, [r.key]: e.target.value })} />
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {pool.map(x => {
                      const on = draft[r.key].includes(x.id);
                      return (
                        <label key={x.id} className={`px-3 py-1.5 rounded-full border text-sm ${may('supervisors') && !locked ? 'cursor-pointer' : 'opacity-60'} ${on ? 'bg-[#008c99] text-white border-[#008c99]' : 'bg-white'}`}>
                          <input type="checkbox" className="sr-only" disabled={!may('supervisors') || locked} checked={on} onChange={() => toggle(r.key, x.id)} />
                          {x.name}{submitted.has(x.id) ? ' ✓' : ''}
                        </label>
                      );
                    })}
                    {pool.length === 0 && <p className="text-sm text-gray-400">No one to choose from.</p>}
                  </div>
                  {submitted.size > 0 && <p className="text-xs text-gray-500">✓ already submitted — removing them keeps their evaluation in the records.</p>}
                </div>
              );
            })}
          </section>
        </div>
      )}
    </SdShell>
  );
}
