'use client';

import { useEffect, useState } from 'react';
import SdShell from '@/components/SdShell';
import { eligibleRubrics } from '@/lib/sd/rubricRules';

const SCALE = [[1, 'Kurang'], [2, 'Cukup'], [3, 'Baik'], [4, 'Sangat Baik']] as const;
type Target = { teacherId: string; name: string; className?: string; subject?: string; category?: string; isPartner?: boolean };
type EvalKind = 'PEER' | 'SUPERVISOR' | 'KOORDINATOR' | 'STUDENT';
type Open = { type: EvalKind; target: Target } | null;

export default function SdTasksPage() {
  const [me, setMe] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [open, setOpen] = useState<Open>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => { const r = await fetch('/api/sd/my-tasks'); if (r.ok) setT(await r.json()); };
  useEffect(() => { (async () => {
    setMe(await (await fetch('/api/me')).json());
    const r = await fetch('/api/rubric'); const d = await r.json(); if (Array.isArray(d)) setRubrics(d.filter((x: any) => x.schoolLevel === 'SD' && !x.isSelfReflection));
    load();
  })(); }, []);

  const rubricFor = (type: string) => eligibleRubrics(type as any, rubrics)[0];
  const rubric = open ? rubricFor(open.type) : null;
  const indicators = rubric ? rubric.sections.flatMap((s: any) => s.categories.flatMap((c: any) => c.indicators)) : [];
  const unanswered = indicators.filter((i: any) => !answers[i.id]).length;

  const submit = async () => {
    if (!open || !rubric) return;
    if (unanswered) return alert(`Please answer all questions (${unanswered} left).`);
    setSaving(true);
    const res = await fetch('/api/sd/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: open.type, targetId: open.target.teacherId, rubricId: rubric.id, scores: indicators.map((i: any) => ({ indicatorId: i.id, value: answers[i.id] })) }) });
    const d = await res.json(); setSaving(false);
    if (!res.ok) return alert(d.error || 'Could not submit');
    setOpen(null); setAnswers({}); load();
  };

  const Card = ({ title, hint, pending, done, type }: { title: string; hint: string; pending: Target[]; done: Target[]; type: EvalKind }) => (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
      <div><h2 className="text-lg font-extrabold text-[#053b50]">{title}</h2><p className="text-sm text-gray-500">{hint}</p></div>
      {pending.length === 0 && done.length === 0 && <p className="text-sm text-gray-400">Nothing assigned to you.</p>}
      {pending.map(p => (
        <div key={p.teacherId} className="flex items-center justify-between gap-3 border rounded-xl p-3">
          <div className="text-sm"><b>{p.name}</b>{p.subject && <span className="text-gray-500"> · {p.subject} {p.className}</span>}</div>
          <button className="px-3 py-1.5 rounded-xl text-sm font-bold bg-[#008c99] text-white" onClick={() => { setAnswers({}); setOpen({ type, target: p }); }}>Evaluate</button>
        </div>
      ))}
      {done.map(p => <div key={p.teacherId} className="text-sm text-green-700 border border-green-200 bg-green-50 rounded-xl p-3">✓ {p.name} — submitted</div>)}
    </section>
  );

  return (
    <SdShell title="My Evaluations" subtitle={t?.period ? `Period: ${t.period.name}` : 'No evaluation period is open right now.'}>
      {t && ['SUPERVISOR', 'PEER', 'KOORDINATOR'].some(k => t.myEvaluators?.[k]?.length) && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-sm space-y-1">
          <h2 className="text-lg font-extrabold text-[#053b50]">Who evaluates you</h2>
          {t.myEvaluators.SUPERVISOR.length > 0 && <p>Supervisor: {t.myEvaluators.SUPERVISOR.join(', ')}</p>}
          {t.myEvaluators.PEER.length > 0 && <p>Peers: {t.myEvaluators.PEER.join(', ')}</p>}
          {t.myEvaluators.KOORDINATOR.length > 0 && <p>Koordinator: {t.myEvaluators.KOORDINATOR.join(', ')}</p>}
        </section>
      )}

      {t && (t.PEER.pending.length + t.PEER.submitted.length > 0) && <Card type="PEER" title="Peer evaluations" hint="Teachers the principal asked you to evaluate as a peer." pending={t.PEER.pending} done={t.PEER.submitted} />}
      {t && (t.SUPERVISOR.pending.length + t.SUPERVISOR.submitted.length > 0) && <Card type="SUPERVISOR" title="Supervisor evaluations" hint="Teachers assigned to you as supervisor." pending={t.SUPERVISOR.pending} done={t.SUPERVISOR.submitted} />}
      {t && (t.KOORDINATOR.pending.length + t.KOORDINATOR.submitted.length > 0) && <Card type="KOORDINATOR" title="Koordinator evaluations" hint="Teachers assigned to you as koordinator." pending={t.KOORDINATOR.pending} done={t.KOORDINATOR.submitted} />}
      {me?.role === 'STUDENT' && t && <Card type="STUDENT" title="Teachers to evaluate" hint="Only the teachers assigned to you by the Vice Principal for Student Affairs." pending={t.STUDENT.pending} done={t.STUDENT.submitted} />}
      {t?.period && ['PEER', 'SUPERVISOR', 'KOORDINATOR', 'STUDENT'].every(k => t[k].pending.length + t[k].submitted.length === 0) && (
        <p className="text-sm text-gray-500">Nothing has been assigned to you in this period.</p>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-6 space-y-5">
            <div className="flex justify-between items-start"><h3 className="text-lg font-bold">Evaluate {open.target.name}</h3><button onClick={() => setOpen(null)} className="text-gray-400">✕</button></div>
            {!rubric ? <p className="text-red-600 text-sm">No SD rubric is available for this evaluation. Ask the admin to add one.</p> : (
              <>
                <p className="text-sm text-gray-500">{rubric.title} · {indicators.length - unanswered}/{indicators.length} answered</p>
                {rubric.sections.map((s: any) => s.categories.map((c: any) => (
                  <div key={c.id} className="space-y-3">
                    <h4 className="font-semibold text-[#008c99]">{c.title}</h4>
                    {c.indicators.map((i: any) => (
                      <div key={i.id} className={`rounded-xl border p-3 ${!answers[i.id] ? '' : 'bg-gray-50'}`}>
                        <p className="text-sm mb-2">{i.text}</p>
                        <div className="flex gap-2">
                          {SCALE.map(([v, l]) => (
                            <label key={v} className={`flex-1 text-center rounded-lg border py-2 text-xs font-semibold cursor-pointer ${answers[i.id] === v ? 'bg-[#008c99] text-white border-[#008c99]' : 'hover:bg-gray-100'}`}>
                              <input type="radio" className="sr-only" name={i.id} checked={answers[i.id] === v} onChange={() => setAnswers({ ...answers, [i.id]: v })} />{v}<br /><span className="font-normal">{l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )))}
                <button disabled={saving} onClick={submit} className="w-full py-3 rounded-xl font-bold bg-[#008c99] text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit evaluation'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </SdShell>
  );
}
