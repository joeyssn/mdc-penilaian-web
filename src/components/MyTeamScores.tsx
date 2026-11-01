'use client';

import { useEffect, useState } from 'react';

// "My scores": what the leader / supervisor, the peers and the koordinator gave the logged-in person in the current period.
// On a dashboard it stays hidden when nobody is assigned to evaluate this person; `always` shows it anyway.
export default function MyTeamScores({ always = false, className = '' }: { always?: boolean; className?: string }) {
  const [results, setResults] = useState<any>(null);
  useEffect(() => { (async () => { try { const r = await fetch('/api/assign/results'); if (r.ok) setResults(await r.json()); } catch {} })(); }, []);

  if (!results?.period) return null;
  const any = results.sources.some((s: any) => s.assigned || s.submitted);
  if (!any && !always) return null;
  const label = (t: string) => (t === 'SUPERVISOR' ? 'Leader / supervisor' : t === 'PEER' ? 'Peers' : 'Koordinator');

  return (
    <section className={`bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3 text-gray-900 [color-scheme:light] ${className}`}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-extrabold text-[#053b50]">My scores <span className="text-sm font-semibold text-gray-700">· {results.period.name}</span></h2>
        <a href="/self-reflection" className="text-sm font-bold text-[#006e7a] hover:underline">Fill in my self-reflection →</a>
      </div>
      {results.locked && <p className="text-sm text-[#b45309] font-semibold">Scores are hidden until they are published.</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        {results.sources.map((s: any) => (
          <div key={s.type} className="rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-sm font-bold text-gray-700">{label(s.type)}</div>
            <div className="text-3xl font-extrabold text-[#053b50] mt-1">{s.average ?? '—'}</div>
            <div className="text-xs text-gray-700 mt-1">{s.assigned ? `${s.submitted} of ${s.assigned} submitted` : 'nobody assigned'}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-700">Scores are on a 1–4 scale; peers are shown as one average.</p>
    </section>
  );
}
