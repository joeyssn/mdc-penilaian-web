'use client';
import { useEffect, useState } from 'react';
import { isSdLayout, resolveProfile } from '@/lib/weights';

// "Self-Reflection" rating card, styled like the other score cards on a dashboard.
export default function SelfRatingCard() {
  const [st, setSt] = useState<{ avg: number; n: number; weight: number; done: boolean } | null>(null);
  useEffect(() => { (async () => {
    try {
      const me = await (await fetch('/api/me')).json();
      if (!me?.id || me.role === 'STUDENT') return;
      const sc = await (await fetch('/api/me/scores')).json();
      if (sc?.locked) return;
      const ws = await (await fetch('/api/settings/weights')).json();
      const w: any = Array.isArray(ws) ? resolveProfile(ws, me.role, me.level) : null;
      // main layout: the Self share of the overall score is main x self share; older profiles keep it as is
      const weight = w ? (isSdLayout(w) ? (Number(w.mainWeight) * Number(w.selfWeight || 0)) / 100 : Number(w.selfWeight) || 0) : 0;
      setSt({ avg: sc?.self?.average || 0, n: sc?.self?.totalEvaluations || 0, weight, done: (sc?.self?.totalEvaluations || 0) > 0 });
    } catch {}
  })(); }, []);

  if (!st) return null;
  const shown = st.avg > 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-extrabold text-black">Self-Reflection</h3>
        <p className="text-gray-500 font-medium mb-4 text-xs">{st.weight > 0 ? `Weight: ${Number(st.weight.toFixed(1))}%` : 'Your own assessment'}</p>
        <div className="flex justify-between items-end mb-3">
          <div className="text-3xl font-extrabold text-purple-600 tracking-tight">{shown ? st.avg.toFixed(1) : '-.-'}</div>
          {!st.done && <a href="/self-reflection" className="text-xs font-bold text-purple-700 underline">Complete it</a>}
        </div>
      </div>
      <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-purple-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(st.avg / 4) * 100}%` }}></div></div>
    </div>
  );
}
