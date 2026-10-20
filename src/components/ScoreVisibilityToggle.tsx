'use client';

import { useEffect, useState } from 'react';

// Admin switch: lock = users cannot see their scores, unlock = users can see their own scores.
export default function ScoreVisibilityToggle() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/settings/score-visibility', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setLocked(d.locked); })
      .catch(() => {});
  }, []);

  const toggle = async () => {
    if (locked === null) return;
    const next = !locked;
    if (!confirm(next
      ? 'Lock scores? Users will no longer be able to see their scores.'
      : 'Unlock scores? Every user will be able to see their own scores.')) return;
    setBusy(true);
    const res = await fetch('/api/settings/score-visibility', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: next }),
    });
    if (res.ok) setLocked(next);
    else alert((await res.json().catch(() => null))?.error || 'Failed to change score visibility.');
    setBusy(false);
  };

  return (
    <div className={`rounded-2xl border-2 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${locked === null ? 'bg-gray-50 border-gray-200' : locked ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <div>
        <h3 className={`text-xl font-extrabold ${locked ? 'text-amber-800' : 'text-green-800'}`}>
          {locked === null ? 'Score visibility' : locked ? 'Scores are LOCKED' : 'Scores are UNLOCKED'}
        </h3>
        <p className={`mt-1 font-medium ${locked ? 'text-amber-700' : 'text-green-700'}`}>
          {locked === null
            ? 'Loading...'
            : locked
              ? 'Users cannot see their scores. Admin and director can always see them.'
              : 'Every user can see their own scores on their dashboard.'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy || locked === null}
        className={`px-8 py-3 rounded-xl font-bold shadow-md text-white transition-all disabled:opacity-50 whitespace-nowrap ${locked ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
      >
        {busy ? 'Saving...' : locked ? 'Unlock Scores' : 'Lock Scores'}
      </button>
    </div>
  );
}
