'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string };
const EVAL: Tab = { href: '/sd/tasks', label: 'My Evaluations' };

// One top bar for every role, used by the dashboards AND the SD screens, so the header never changes between pages.
const TABS: Record<string, Tab[]> = {
  ADMIN: [{ href: '/admin', label: 'Live Overview & Weights' }, { href: '/sd/groups', label: 'SD Groups & Supervisors' }],
  PRINCIPAL: [{ href: '/principal', label: 'My Dashboard' }, { href: '/principal/rubrics', label: 'Assign Rubrics' }, { href: '/sd/groups', label: 'SD Groups & Supervisors' }, EVAL],
  VICE_PRINCIPAL_KESISWAAN: [{ href: '/vice-principal', label: 'My Dashboard' }, { href: '/sd/student-assignments', label: 'Student Assignments' }, EVAL],
  VICE_PRINCIPAL_KURIKULUM: [{ href: '/vice-principal', label: 'My Dashboard' }, EVAL],
  TEACHER: [{ href: '/teachers', label: 'My Dashboard' }, EVAL],
  STAFF: [{ href: '/staff', label: 'My Dashboard' }, EVAL],
  STUDENT: [{ href: '/student', label: 'Home' }, EVAL],
};

export default function RoleNav() {
  const path = usePathname();
  const [role, setRole] = useState<string>('');
  const [level, setLevel] = useState<string>('');

  useEffect(() => {
    try { setRole(sessionStorage.getItem('navRole') || ''); setLevel(sessionStorage.getItem('navLevel') || ''); } catch {}   // remembered, so the bar does not flicker between pages
    (async () => {
      const r = await fetch('/api/me'); if (!r.ok) return;
      const me = await r.json();
      setRole(me.role); setLevel((me.level || '').toUpperCase());
      try { sessionStorage.setItem('navRole', me.role); sessionStorage.setItem('navLevel', (me.level || '').toUpperCase()); } catch {}
    })();
  }, []);

  // The SD teacher evaluation screens exist only for TK and SD; SMP / SMA people never see them.
  const noSd = level === 'SMP' || level === 'SMA';
  const tabs = (TABS[role] ?? []).filter(t => !(noSd && t.href.startsWith('/sd/')));
  return (
    <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 gap-4 print:hidden">
      <div className="flex items-center">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
      </div>
      <div className="flex gap-8 text-[15px] font-bold overflow-x-auto whitespace-nowrap scrollbar-hide min-h-[28px]">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className={`pb-1 transition-all border-b-2 ${path === t.href ? 'text-[#053b50] border-[#008c99]' : 'border-transparent text-gray-500 hover:text-[#053b50]'}`}>{t.label}</Link>
        ))}
      </div>
      <Link href="/login" onClick={() => { try { sessionStorage.removeItem('navRole'); sessionStorage.removeItem('navLevel'); } catch {} }} className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
    </nav>
  );
}
