'use client';

import { useEffect, useState } from 'react';
import SdShell from '@/components/SdShell';
import { eligibleRubrics } from '@/lib/sd/rubricRules';

const SCALE = [[1, 'Kurang'], [2, 'Cukup'], [3, 'Baik'], [4, 'Sangat Baik']] as const;
type Target = { teacherId: string; name: string; className?: string; subject?: string; category?: string; isPartner?: boolean; school?: string };
type EvalKind = 'PEER' | 'SUPERVISOR' | 'KOORDINATOR' | 'STUDENT';
type Open = { type: EvalKind; target: Target } | null;

// Student faces for the 1-4 scale (1 = lowest, 4 = highest).
const EMOJI_SCALE: [number, string, string][] = [[1, '😞', 'Kurang'], [2, '😐', 'Cukup'], [3, '🙂', 'Baik'], [4, '😄', 'Sangat baik']];

// general = the evaluations of vice principals, division workers, karyawan and SMP / SMA teachers (non-SD rubrics, /api/assign/evaluations).
export default function SdTasks({ embedded = false, general = false }: { embedded?: boolean; general?: boolean }) {
  const [me, setMe] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [open, setOpen] = useState<Open>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // TK / SD teachers are evaluated in the SD flow, everyone else in the SMP / SMA flow; the two never mix on one screen.
  const keep = (rows: Target[]) => rows.filter(x => (general ? x.school !== 'SD' : x.school ? x.school === 'SD' : true));
  const load = async () => {
    const r = await fetch('/api/sd/my-tasks'); if (!r.ok) return;
    const d = await r.json();
    for (const k of ['PEER', 'SUPERVISOR', 'KOORDINATOR']) if (d[k]) d[k] = { pending: keep(d[k].pending), submitted: keep(d[k].submitted) };
    setT(d);
  };
  useEffect(() => { (async () => {
    const meData = await (await fetch('/api/me')).json(); setMe(meData);
    const r = await fetch('/api/rubric?assigned=1'); const d = await r.json(); if (!r.ok) console.error('Could not load rubrics', d); if (Array.isArray(d)) setRubrics(d.filter((x: any) => (general ? x.schoolLevel !== 'SD' : x.schoolLevel === 'SD') && !x.isSelfReflection));
    load();
  })(); }, []);

  const rubricFor = (type: string, target?: any) => eligibleRubrics(type as any, rubrics, { evaluatorRole: me?.role, targetRole: target?.role })[0];
  const rubric = open ? rubricFor(open.type, open.target) : null;
  const indicators = rubric ? rubric.sections.flatMap((s: any) => s.categories.flatMap((c: any) => c.indicators)) : [];
  const unanswered = indicators.filter((i: any) => !answers[i.id]).length;

  const submit = async () => {
    if (!open || !rubric) return;
    if (unanswered) return alert(`Please answer all questions (${unanswered} left).`);
    setSaving(true);
    const res = await fetch(general ? '/api/assign/evaluations' : '/api/sd/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: open.type, targetId: open.target.teacherId, rubricId: rubric.id, scores: indicators.map((i: any) => ({ indicatorId: i.id, value: answers[i.id] })) }) });
    const d = await res.json(); setSaving(false);
    if (!res.ok) return alert(d.error || 'Could not submit');
    setOpen(null); setAnswers({}); load();
  };

  const Card = ({ title, hint, pending, done, type }: { title: string; hint: string; pending: Target[]; done: Target[]; type: EvalKind }) => (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
      <div><h2 className="text-lg font-extrabold text-[#053b50]">{title}</h2><p className="text-sm text-gray-700">{hint}</p></div>
      {pending.length === 0 && done.length === 0 && <p className="text-sm text-gray-600">Nothing assigned to you.</p>}
      {pending.map(p => (
        <div key={p.teacherId} className="flex items-center justify-between gap-3 border rounded-xl p-3">
          <div className="text-sm"><b>{p.name}</b>{p.subject && <span className="text-gray-700"> · {p.subject} {p.className}</span>}</div>
          <button className="px-3 py-1.5 rounded-xl text-sm font-bold bg-[#008c99] text-white" onClick={() => { setAnswers({}); setOpen({ type, target: p }); }}>Evaluate</button>
        </div>
      ))}
      {done.map(p => <div key={p.teacherId} className="text-sm text-green-700 border border-green-200 bg-green-50 rounded-xl p-3">✓ {p.name} — submitted</div>)}
    </section>
  );

  const body = (
    <>
      {t && (t.PEER.pending.length + t.PEER.submitted.length > 0) && <Card type="PEER" title="Peer evaluations" hint="Teachers the principal asked you to evaluate as a peer." pending={t.PEER.pending} done={t.PEER.submitted} />}
      {t && (t.SUPERVISOR.pending.length + t.SUPERVISOR.submitted.length > 0) && <Card type="SUPERVISOR" title="Supervisor evaluations" hint="Teachers assigned to you as supervisor." pending={t.SUPERVISOR.pending} done={t.SUPERVISOR.submitted} />}
      {t && (t.KOORDINATOR.pending.length + t.KOORDINATOR.submitted.length > 0) && <Card type="KOORDINATOR" title="Koordinator evaluations" hint="Teachers assigned to you as koordinator." pending={t.KOORDINATOR.pending} done={t.KOORDINATOR.submitted} />}
      {me?.role === 'STUDENT' && t && <Card type="STUDENT" title="Teachers to evaluate" hint="Your class teachers (and any the Vice Principal added). Tap a face to score each question." pending={t.STUDENT.pending} done={t.STUDENT.submitted} />}
      {t?.period && ['PEER', 'SUPERVISOR', 'KOORDINATOR', 'STUDENT'].every(k => t[k].pending.length + t[k].submitted.length === 0) && (
        <p className="text-sm text-gray-700">Nothing has been assigned to you in this period.</p>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white text-gray-900 [color-scheme:light] rounded-2xl w-full max-w-2xl my-8 p-6 space-y-5">
            <div className="flex justify-between items-start"><h3 className="text-lg font-bold">Evaluate {open.target.name}</h3><button onClick={() => setOpen(null)} className="text-gray-600">✕</button></div>
            {!rubric ? <p className="text-red-600 text-sm">No {general ? 'SMP / SMA' : 'SD'} rubric is available for this evaluation. Ask the admin to add one.</p> : (
              <>
                <p className="text-sm text-gray-700">{rubric.title} · {indicators.length - unanswered}/{indicators.length} answered</p>
                {rubric.sections.map((s: any) => s.categories.map((c: any) => (
                  <div key={c.id} className="space-y-3">
                    <h4 className="font-semibold text-[#006e7a] text-base">{c.title}</h4>
                    {c.indicators.map((i: any) => (
                      <div key={i.id} className={`rounded-xl border p-3 ${!answers[i.id] ? '' : 'bg-gray-50'}`}>
                        <p className="text-base font-medium text-gray-900 mb-3">{i.text}</p>
                        <div className="flex gap-2">
                          {open?.type === 'STUDENT' ? EMOJI_SCALE.map(([v, e, l]) => (
                            // Students pick a face. The saved value is still 1-4, so the scoring formula does not change.
                            <label key={v} className={`flex-1 text-center rounded-xl border-2 py-3 cursor-pointer transition ${answers[i.id] === v ? 'bg-[#008c99]/10 border-[#008c99] scale-105' : 'border-gray-200 hover:bg-gray-100'}`}>
                              <input type="radio" className="sr-only" name={i.id} checked={answers[i.id] === v} onChange={() => setAnswers({ ...answers, [i.id]: v })} aria-label={l} />
                              <span className="block text-4xl leading-none" aria-hidden>{e}</span>
                              <span className="block text-xs font-bold text-gray-800 mt-1">{l}</span>
                            </label>
                          )) : SCALE.map(([v, l]) => (
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
    </>
  );
  return embedded ? <div className="space-y-6 text-gray-900 [color-scheme:light]">{body}</div> : <SdShell title="My Evaluations" subtitle={t?.period ? `Period: ${t.period.name}` : 'No evaluation period is open right now.'}>{body}</SdShell>;
}
