'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

// "Complete My Self-Reflection" button. It disappears once your self-reflection is submitted (it can only be done once).
export default function SelfReflectionLink({ className, children }: { className?: string; children?: ReactNode }) {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => { (async () => {
    try {
      const me = await (await fetch('/api/me')).json();
      if (!me?.id || me.role === 'STUDENT') return setDone(true);
      const c = await fetch(`/api/evaluate/completed?graderId=${me.id}`);
      setDone(c.ok ? (await c.json()).includes(me.id) : false);
    } catch { setDone(false); }
  })(); }, []);
  if (done !== false) return null; // hidden while loading and after it is done
  return <Link href="/self-reflection" className={className}>{children}</Link>;
}
