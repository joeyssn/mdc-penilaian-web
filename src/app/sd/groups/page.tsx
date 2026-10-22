'use client';

import { useCallback, useEffect, useState } from 'react';
import SdShell from '@/components/SdShell';

const SUBJECTS = [['MATEMATIKA', 'Matematika (EXACT)'], ['IPA', 'IPA (EXACT)'], ['BAHASA_INDONESIA', 'Bahasa Indonesia (NON-EXACT)'], ['PPKN', 'PPKN (NON-EXACT)']];
const label = (s: string) => SUBJECTS.find(x => x[0] === s)?.[1] ?? s;

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data.error || 'Something went wrong'); return null; }
  return data;
}

export default function SdGroupsPage() {
  const [me, setMe] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [cand, setCand] = useState<{ teachers: any[]; supervisors: any[] }>({ teachers: [], supervisors: [] });
  const [sups, setSups] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [perms, setPerms] = useState<any>(null);
  const [problems, setProblems] = useState<Record<string, string[]>>({});
  const [newPeriod, setNewPeriod] = useState('');
  const [g, setG] = useState({ name: '', classOne: '', classTwo: '', level: 'SD' });
  const [m, setM] = useState<Record<string, { teacherId: string; className: string; subject: string }>>({});
  const [sv, setSv] = useState({ supervisorId: '', teacherId: '' });

  const period = periods.find(p => p.id === periodId);
  const isPrincipal = me?.role === 'PRINCIPAL';
  const may = (p: 'publish' | 'supervisors' | 'periods') => isPrincipal || (me?.role === 'ADMIN' && perms?.adminSd?.[p]);

  const loadPeriods = useCallback(async () => {
    const ps = await (await fetch('/api/sd/periods')).json();
    if (Array.isArray(ps)) { setPeriods(ps); setPeriodId(cur => cur || ps.find((p: any) => p.status === 'OPEN')?.id || ps[0]?.id || ''); }
  }, []);
  const loadPeriodData = useCallback(async (id: string) => {
    if (!id) return;
    const [gr, su, pr] = await Promise.all([fetch(`/api/sd/groups?periodId=${id}`), fetch(`/api/sd/supervisors?periodId=${id}`), fetch(`/api/sd/evaluations?periodId=${id}`)]);
    if (gr.ok) setGroups(await gr.json());
    if (su.ok) setSups(await su.json());
    if (pr.ok) setProgress(await pr.json());
  }, []);

  useEffect(() => {
    (async () => {
      setMe(await (await fetch('/api/me')).json());
      loadPeriods();
      const t = await fetch('/api/sd/teachers'); if (t.ok) setCand(await t.json());
      const p = await fetch('/api/sd/permissions'); if (p.ok) setPerms(await p.json());
    })();
  }, [loadPeriods]);
  useEffect(() => { loadPeriodData(periodId); }, [periodId, loadPeriodData]);

  const refresh = () => { loadPeriods(); loadPeriodData(periodId); };
  const patch = async (id: string, body: any) => { const r = await call(`/api/sd/groups/${id}`, 'PATCH', body); if (r) refresh(); return r; };
  const validate = async (id: string) => {
    const r = await call(`/api/sd/groups/${id}`, 'PATCH', { action: 'validate' });
    if (r) setProblems(p => ({ ...p, [id]: r.errors }));
  };
  const publish = async (id: string) => {
    const res = await fetch(`/api/sd/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) });
    const data = await res.json();
    if (!res.ok) { setProblems(p => ({ ...p, [id]: data.errors || [data.error] })); return; }
    setProblems(p => ({ ...p, [id]: [] })); refresh();
  };

  const locked = period?.status === 'CLOSED';
  const input = 'border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm';
  const btn = 'px-3 py-2 rounded-xl text-sm font-bold bg-[#008c99] text-white hover:bg-[#007b87] disabled:opacity-40';
  const ghost = 'px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-[#053b50] hover:bg-gray-50';

  return (
    <SdShell title="SD Teacher Groups & Supervisors" subtitle="Each group has exactly two classes. Peer scoring stays inside the group and inside EXACT / NON-EXACT.">
      {/* Period */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-lg font-extrabold text-[#053b50]">Evaluation period</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={input} value={periodId} onChange={e => setPeriodId(e.target.value)}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
          </select>
          {period?.status === 'DRAFT' && may('periods') && <button className={btn} onClick={async () => { if (confirm('Open this period? Evaluations can then be submitted.')) await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'OPEN' }) && refresh(); }}>Open period</button>}
          {period?.status === 'OPEN' && may('periods') && <button className={btn} onClick={async () => { if (confirm('Close this period? Assignments and groups become read-only.')) await call('/api/sd/periods', 'PATCH', { id: periodId, status: 'CLOSED' }) && refresh(); }}>Close period</button>}
          {may('periods') && (<>
            <input className={input} placeholder="New period, e.g. 2026/2027 Semester 1" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} />
            <button className={btn} disabled={!newPeriod.trim()} onClick={async () => { if (await call('/api/sd/periods', 'POST', { name: newPeriod })) { setNewPeriod(''); loadPeriods(); } }}>Add period</button>
          </>)}
        </div>
        {isPrincipal && perms && (
          <div className="text-sm border-t pt-3">
            <p className="font-semibold mb-1">What Admin SD may do (besides editing draft groups)</p>
            {(['publish', 'supervisors', 'periods'] as const).map(k => (
              <label key={k} className="mr-5 inline-flex items-center gap-2">
                <input type="checkbox" checked={!!perms.adminSd[k]} onChange={async e => { if (await call('/api/sd/permissions', 'PUT', { permission: k, value: e.target.checked })) setPerms({ ...perms, adminSd: { ...perms.adminSd, [k]: e.target.checked } }); }} />
                {k === 'publish' ? 'Publish / unpublish groups' : k === 'supervisors' ? 'Assign supervisors' : 'Open / close periods'}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Groups */}
      {period && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-[#053b50]">Groups</h2>
          {!locked && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-wrap gap-2 items-end">
              {!['TK', 'SD'].includes(me?.level) && (
                <select className={input} value={g.level} onChange={e => setG({ ...g, level: e.target.value })}><option value="SD">SD</option><option value="TK">TK</option></select>
              )}
              <input className={input} placeholder="Group name" value={g.name} onChange={e => setG({ ...g, name: e.target.value })} />
              <input className={input} placeholder="Class 1 (e.g. 1A)" value={g.classOne} onChange={e => setG({ ...g, classOne: e.target.value })} />
              <input className={input} placeholder="Class 2 (e.g. 1B)" value={g.classTwo} onChange={e => setG({ ...g, classTwo: e.target.value })} />
              <button className={btn} onClick={async () => { if (await call('/api/sd/groups', 'POST', { ...g, periodId })) { setG({ name: '', classOne: '', classTwo: '', level: g.level }); refresh(); } }}>Create group</button>
            </div>
          )}
          {groups.map(gr => {
            const draft = gr.status === 'DRAFT' && !locked;
            const f = m[gr.id] ?? { teacherId: '', className: gr.classOne, subject: 'MATEMATIKA' };
            const set = (v: Partial<typeof f>) => setM({ ...m, [gr.id]: { ...f, ...v } });
            return (
              <div key={gr.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#053b50]">{gr.name} <span className="text-gray-500 font-normal">· {gr.classOne} + {gr.classTwo}{gr.level ? ` · ${gr.level}` : ''}</span></h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gr.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : gr.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{gr.status}</span>
                  </div>
                  {!locked && (
                    <div className="flex flex-wrap gap-2">
                      {gr.status === 'DRAFT' && <button className={ghost} onClick={() => validate(gr.id)}>Check</button>}
                      {gr.status === 'DRAFT' && may('publish') && <button className={btn} onClick={() => publish(gr.id)}>Publish</button>}
                      {gr.status === 'PUBLISHED' && may('publish') && <button className={ghost} onClick={() => confirm('Unpublish? Teachers lose access to this group until it is published again.') && patch(gr.id, { action: 'unpublish' })}>Unpublish</button>}
                      {gr.status === 'PUBLISHED' && may('publish') && <button className={ghost} onClick={() => confirm('Deactivate this group?') && patch(gr.id, { action: 'deactivate' })}>Deactivate</button>}
                      {gr.status === 'DRAFT' && <button className={ghost} onClick={async () => { if (confirm('Delete this draft group?') && await call(`/api/sd/groups/${gr.id}`, 'DELETE')) refresh(); }}>Delete</button>}
                    </div>
                  )}
                </div>
                {problems[gr.id]?.length > 0 && <ul className="text-sm text-red-600 list-disc pl-5">{problems[gr.id].map((e, i) => <li key={i}>{e}</li>)}</ul>}
                {problems[gr.id] && problems[gr.id].length === 0 && <p className="text-sm text-green-600">No problems found.</p>}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500"><th className="py-1">Class</th><th>Subject</th><th>Teacher</th><th>Partner</th>{draft && <th />}</tr></thead>
                    <tbody>
                      {gr.members.map((mm: any) => (
                        <tr key={mm.id} className="border-t">
                          <td className="py-1.5">{mm.className}</td><td>{label(mm.subject)}</td><td>{mm.teacher.name}</td>
                          <td>{draft ? (
                            <select className="border rounded px-2 py-1 text-xs" value={mm.partnerId ?? ''} onChange={e => e.target.value ? patch(gr.id, { action: 'setPartner', memberId: mm.id, partnerMemberId: e.target.value }) : patch(gr.id, { action: 'clearPartner', memberId: mm.id })}>
                              <option value="">— none —</option>
                              {gr.members.filter((o: any) => o.id !== mm.id && o.className === mm.className).map((o: any) => <option key={o.id} value={o.id}>{o.teacher.name} ({label(o.subject)})</option>)}
                            </select>
                          ) : (gr.members.find((o: any) => o.id === mm.partnerId)?.teacher.name ?? '—')}</td>
                          {draft && <td><button className="text-red-600 text-xs" onClick={() => patch(gr.id, { action: 'removeMember', memberId: mm.id })}>Remove</button></td>}
                        </tr>
                      ))}
                      {gr.members.length === 0 && <tr><td colSpan={5} className="text-gray-400 py-2">No teachers yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {draft && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <select className={input} value={f.teacherId} onChange={e => set({ teacherId: e.target.value })}>
                      <option value="">Teacher…</option>{cand.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select className={input} value={f.className} onChange={e => set({ className: e.target.value })}>
                      <option>{gr.classOne}</option><option>{gr.classTwo}</option>
                    </select>
                    <select className={input} value={f.subject} onChange={e => set({ subject: e.target.value })}>
                      {SUBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button className={btn} disabled={!f.teacherId} onClick={() => patch(gr.id, { action: 'addMember', ...f })}>Add teacher</button>
                  </div>
                )}
              </div>
            );
          })}
          {groups.length === 0 && <p className="text-gray-500 text-sm">No groups in this period yet.</p>}
        </section>
      )}

      {/* Supervisors */}
      {period && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-extrabold text-[#053b50]">Supervisors</h2>
          <p className="text-sm text-gray-500">A supervisor is an additional evaluator. It does not depend on group or category and does not change the teacher&apos;s partner.</p>
          {may('supervisors') && !locked && (
            <div className="flex flex-wrap gap-2">
              <select className={input} value={sv.teacherId} onChange={e => setSv({ ...sv, teacherId: e.target.value })}><option value="">Teacher…</option>{cand.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select className={input} value={sv.supervisorId} onChange={e => setSv({ ...sv, supervisorId: e.target.value })}><option value="">Supervisor…</option>{cand.supervisors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <button className={btn} disabled={!sv.teacherId || !sv.supervisorId} onClick={async () => { if (await call('/api/sd/supervisors', 'POST', { periodId, ...sv })) { setSv({ supervisorId: '', teacherId: '' }); refresh(); } }}>Assign</button>
            </div>
          )}
          <table className="w-full text-sm"><tbody>
            {sups.map(s => (
              <tr key={s.id} className="border-t"><td className="py-1.5">{s.teacher.name}</td><td>supervised by {s.supervisor.name}</td><td>{s._count.evaluations ? 'submitted' : 'pending'}</td>
                <td>{may('supervisors') && !locked && <button className="text-red-600 text-xs" onClick={async () => { if (await call(`/api/sd/supervisors?id=${s.id}`, 'DELETE')) refresh(); }}>Remove</button>}</td></tr>
            ))}
            {sups.length === 0 && <tr><td className="text-gray-400">No supervisor assignments.</td></tr>}
          </tbody></table>
        </section>
      )}

      {/* Progress */}
      {period && progress.length > 0 && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-2 overflow-x-auto">
          <h2 className="text-lg font-extrabold text-[#053b50]">Evaluation progress (three separate sources)</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="py-1">Teacher</th><th>Group</th><th>Category</th><th>Peer</th><th>Supervisor</th><th>Student</th></tr></thead>
            <tbody>
              {progress.map(r => (
                <tr key={r.teacherId} className="border-t">
                  <td className="py-1.5">{r.name}</td><td>{r.group}</td><td>{r.category === 'EXACT' ? 'EXACT' : 'NON-EXACT'}</td>
                  {(['peer', 'supervisor', 'student'] as const).map(k => (
                    <td key={k}>{r[k].submitted}{r[k].assigned !== undefined ? ` / ${r[k].assigned}` : ''}{r[k].average != null ? ` · avg ${r[k].average}` : ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </SdShell>
  );
}
