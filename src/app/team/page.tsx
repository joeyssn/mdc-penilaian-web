'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RoleNav from '@/components/RoleNav';
import MyTeamScores from '@/components/MyTeamScores';
import SdTasks from '@/components/SdTasks';

const ROLE_NAME: Record<string, string> = { SUPERVISOR: 'Leader', PEER: 'Peer', KOORDINATOR: 'Koordinator' };
const DIVISION_ROLES = ['IT', 'PR', 'ACC', 'ADMIN', 'HRD'];

// My Dashboard for the division teams (IT, PR, ACC, admin): my scores from leader / peers / koordinator,
// the people I have to evaluate, and who evaluates me.
export default function TeamDashboard() {
  const [me, setMe] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => { (async () => {
    try { const r = await fetch('/api/me'); if (r.ok) setMe(await r.json()); } catch {}
    try { const r = await fetch('/api/assign'); if (r.ok) setInfo(await r.json()); } catch {}
  })(); }, []);

  const division = me && DIVISION_ROLES.includes(me.role) ? me.role : '';
  const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6';
  const evaluatedBy: { id: string; name: string; role: string }[] = info?.evaluatedBy ?? [];
  const toEvaluate: { id: string; name: string; role: string }[] = info?.toEvaluate ?? [];

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans text-gray-900 [color-scheme:light]">
      <RoleNav />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-20 space-y-6">
        {me && <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Hi, Welcome {me.name}</h1>}

        <div className="bg-[#008c99] rounded-2xl px-6 py-6 md:px-8 md:py-8 text-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-wide">Team Evaluation</h2>
            <p className="text-sm font-medium opacity-90 mt-2 max-w-lg">See how your leader, peers and koordinator scored you, and evaluate the colleagues assigned to you.</p>
          </div>
          {division && (
            <div className="bg-white/20 px-6 py-3 rounded-xl backdrop-blur-sm shrink-0 border border-white/20 text-center w-full md:w-auto">
              <div className="text-xs uppercase tracking-widest font-bold opacity-80">Your Division</div>
              <div className="text-2xl font-extrabold">{division}</div>
            </div>
          )}
        </div>

        <MyTeamScores always />

        <div className="grid md:grid-cols-2 gap-6">
          <section className={`${card} space-y-2`}>
            <h2 className="text-lg font-extrabold text-[#053b50]">Who evaluates me</h2>
            {evaluatedBy.length === 0 ? <p className="text-sm text-gray-700">Nobody has been assigned to evaluate you yet.</p> : evaluatedBy.map((a, i) => (
              <div key={`${a.id}-${a.role}-${i}`} className="flex justify-between text-sm border-b border-gray-100 py-1.5"><b>{a.name}</b><span className="text-gray-700">{ROLE_NAME[a.role] ?? a.role}</span></div>
            ))}
          </section>
          <section className={`${card} space-y-2`}>
            <h2 className="text-lg font-extrabold text-[#053b50]">Who I evaluate</h2>
            {toEvaluate.length === 0 ? <p className="text-sm text-gray-700">Nobody has been assigned to you yet.</p> : toEvaluate.map((a, i) => (
              <div key={`${a.id}-${a.role}-${i}`} className="flex justify-between text-sm border-b border-gray-100 py-1.5"><b>{a.name}</b><span className="text-gray-700">{ROLE_NAME[a.role] ?? a.role}</span></div>
            ))}
          </section>
        </div>

        <SdTasks embedded general />

        <p className="text-sm text-gray-700">Your own reflection: <Link href="/self-reflection" className="font-bold text-[#006e7a] hover:underline">fill in my self-reflection →</Link></p>
      </div>
    </div>
  );
}
