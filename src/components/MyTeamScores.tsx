'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ScoresLockedNotice from '@/components/ScoresLockedNotice';

// "Scores from others": what the leader / supervisor, the peers and the koordinator gave the logged-in person in the current period.
// Same look as the other dashboards: a Final Evaluation Rating banner and one progress card per source.
// On a dashboard it stays hidden when nobody is assigned to evaluate this person; `always` shows it anyway.
const SOURCES: Record<string, { title: string; text: string; bar: string }> = {
  SUPERVISOR: { title: 'Leader / Supervisor', text: 'text-[#008c99]', bar: 'bg-[#008c99]' },
  PEER: { title: 'Scores from Others', text: 'text-[#f39c12]', bar: 'bg-[#f39c12]' },
  KOORDINATOR: { title: 'Koordinator', text: 'text-green-600', bar: 'bg-green-600' },
};

export default function MyTeamScores({ always = false, selfReflection = true, className = '' }: { always?: boolean; selfReflection?: boolean; className?: string }) {
  const [results, setResults] = useState<any>(null);
  const [failed, setFailed] = useState('');
  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/assign/results');
      const d = await r.json().catch(() => ({}));
      if (r.ok) setResults(d); else { setFailed(d.error || 'Could not load your scores.'); setResults({ period: null, sources: [] }); }
    } catch { setFailed('Could not load your scores.'); setResults({ period: null, sources: [] }); }
  })(); }, []);

  if (!results) return null;
  // No evaluation period exists yet: show an empty rating (when `always`) instead of nothing.
  const noPeriod = !results.period;
  const sources: any[] = noPeriod ? ['SUPERVISOR', 'PEER', 'KOORDINATOR'].map(type => ({ type, assigned: 0, submitted: 0, average: null })) : results.sources;
  const any = sources.some((s: any) => s.assigned || s.submitted);
  if (!any && !always) return null;

  const withScore = sources.filter((s: any) => s.average != null);
  const overall = withScore.length ? (withScore.reduce((a: number, s: any) => a + s.average, 0) / withScore.length).toFixed(2) : '-.-';

  return (
    <div className={`space-y-6 text-gray-900 [color-scheme:light] ${className}`}>
      {failed && always && <p className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm font-semibold">{failed} If you just updated the site, run <code>npx prisma db push</code> and <code>npx prisma generate</code>, then restart the server.</p>}
      {results.locked ? <ScoresLockedNotice /> : (
        <>
          <div className="bg-[#053b50] rounded-2xl px-6 py-6 md:px-8 md:py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-md border border-gray-800">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-wide">Final Evaluation Rating</h2>
              <p className="text-sm font-medium mt-1 text-gray-300">Your overall score from your leader, peers and koordinator · {results.period?.name ?? 'no evaluation period yet'}</p>
            </div>
            <div className="text-center md:text-right">
              <div className="text-5xl font-extrabold tracking-tight text-[#e99a24]">{overall}</div>
              <div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sources.map((s: any) => {
              const v = SOURCES[s.type];
              return (
                <div key={s.type} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-black">{v.title}</h3>
                    <p className="text-gray-500 font-medium mb-4 text-xs">{s.assigned ? `${s.submitted} of ${s.assigned} submitted` : 'Nobody assigned'}</p>
                    <div className="flex justify-between items-end mb-3">
                      <div className={`text-3xl font-extrabold tracking-tight ${v.text}`}>{s.average != null ? Number(s.average).toFixed(1) : '-.-'}</div>
                      <div className={`text-xs font-bold ${v.text}`}>({s.submitted} {s.submitted === 1 ? 'review' : 'reviews'})</div>
                    </div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className={`${v.bar} h-3 rounded-full transition-all duration-1000`} style={{ width: `${((s.average ?? 0) / 4) * 100}%` }}></div></div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {selfReflection && <Link href="/self-reflection" className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md text-center transition-all">Complete My Self-Reflection</Link>}
    </div>
  );
}
