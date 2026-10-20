'use client';

import { useEffect, useState } from 'react';

type LockEvent = { id: string; action: string; actorName: string; actorRole: string; createdAt: string };
type Cycle = {
  id: string; name: string; schoolLevel: string; status: string; scoresLocked: boolean; lockEvents: LockEvent[];
};

// canManage = admin: can also create / close cycles. Principals can only lock / unlock.
export default function CycleLockPanel({ canManage }: { canManage: boolean }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('SD');

  const load = async () => {
    const res = await fetch('/api/cycles', { cache: 'no-store' });
    if (res.ok) setCycles(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) alert((await res.json().catch(() => null))?.error || 'Something went wrong.');
    await load();
  };

  const toggleLock = async (c: Cycle) => {
    const next = !c.scoresLocked;
    if (!confirm(next ? `Lock scores for "${c.name}"?` : `Unlock scores for "${c.name}"? Users in ${c.schoolLevel} will be able to see their results.`)) return;
    setBusyId(c.id);
    await call(`/api/cycles/${c.id}/lock`, 'PUT', { locked: next });
    setBusyId(null);
  };

  const create = async () => {  
    if (!name.trim()) return;
    await call('/api/cycles', 'POST', { name, schoolLevel: level });
    setName('');
  };

  const close = async (c: Cycle) => {
    if (!confirm(`Close "${c.name}"? A closed cycle is kept for history and can't be reopened.`)) return;
    await call(`/api/cycles/${c.id}/close`, 'PUT');
  };

  if (loading) return <div className="text-gray-500 font-bold">Loading cycles...</div>;

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="text-sm font-bold text-gray-700">New cycle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Semester Ganjil 2026/2027"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-1 outline-none" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">School level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="block border border-gray-300 rounded-lg px-4 py-2 mt-1 bg-white">
              <option>SD</option><option>SMP</option><option>SMA</option>
            </select>
          </div>
          <button onClick={create} disabled={!name.trim()} className="bg-[#008c99] hover:bg-[#007b87] text-white font-bold px-6 py-2.5 rounded-lg disabled:opacity-40">
            Create cycle
          </button>
        </div>
      )}

      {cycles.length === 0 && (
        <p className="text-gray-500 font-medium">
          No cycles yet.{canManage ? ' Create one above. Until a cycle exists, scores stay locked for everyone except admin and director.' : ' Ask the admin to create one.'}
        </p>
      )}

      {cycles.map(c => (
        <div key={c.id} className={`rounded-2xl border-2 p-5 ${c.status === 'CLOSED' ? 'bg-gray-50 border-gray-200' : c.scoresLocked ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#053b50]">{c.name} <span className="text-sm font-bold text-gray-500">({c.schoolLevel})</span></h3>
              <p className="font-medium text-gray-600">
                {c.status === 'CLOSED' ? 'Closed' : c.scoresLocked ? 'Open, scores LOCKED' : 'Open, scores UNLOCKED'}
              </p>
            </div>
            {c.status === 'OPEN' && (
              <div className="flex gap-2">
                <button onClick={() => toggleLock(c)} disabled={busyId === c.id}
                  className={`px-6 py-2.5 rounded-xl font-bold text-white disabled:opacity-50 ${c.scoresLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {c.scoresLocked ? 'Unlock Scores' : 'Lock Scores'}
                </button>
                {canManage && (
                  <button onClick={() => close(c)} className="px-4 py-2.5 rounded-xl font-bold border border-gray-300 text-gray-700 hover:bg-white">Close cycle</button>
                )}
              </div>
            )}
          </div>
          {c.lockEvents.length > 0 && (
            <ul className="mt-4 text-sm text-gray-600 space-y-1">
              {c.lockEvents.map(e => (
                <li key={e.id}>{e.action === 'UNLOCKED' ? 'Unlocked' : 'Locked'} by {e.actorName} ({e.actorRole}) on {new Date(e.createdAt).toLocaleString()}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
