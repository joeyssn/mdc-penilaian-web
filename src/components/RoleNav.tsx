'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string };
const EVAL: Tab = { href: '/sd/tasks', label: 'My Evaluations' };

// One top bar for every role, used by the dashboards AND the SD screens, so the header never changes between pages.
const TABS: Record<string, Tab[]> = {
  ADMIN: [{ href: '/admin', label: 'Live Overview & Weights' }, { href: '/sd/assignments', label: 'Assign Evaluators' }],
  PRINCIPAL: [{ href: '/principal', label: 'My Dashboard' }, { href: '/principal/rubrics', label: 'Assign Rubrics' }, { href: '/sd/assignments', label: 'Assign Evaluators' }, { href: '/assign', label: 'Assign Evaluators' }, EVAL],
  DIRECTOR: [{ href: '/director', label: 'My Dashboard' }, { href: '/assign', label: 'Assign Evaluators' }],
  HEAD_MANAGEMENT: [{ href: '/assign', label: 'Assign Evaluators' }],
  IT: [{ href: '/assign', label: 'My Evaluations' }],
  PR: [{ href: '/assign', label: 'My Evaluations' }],
  ACC: [{ href: '/assign', label: 'My Evaluations' }],
  VICE_PRINCIPAL_KESISWAAN: [{ href: '/vice-principal', label: 'My Dashboard' }, { href: '/assign', label: 'Assign Evaluators' }, { href: '/sd/student-assignments', label: 'Student Assignments' }, EVAL],
  VICE_PRINCIPAL_KURIKULUM: [{ href: '/vice-principal', label: 'My Dashboard' }, { href: '/assign', label: 'Assign Evaluators' }, EVAL],
  TEACHER: [{ href: '/teachers', label: 'My Dashboard' }, EVAL, { href: '/assign', label: 'Team Evaluations' }],
  STAFF: [{ href: '/staff', label: 'My Dashboard' }, EVAL, { href: '/assign', label: 'Team Evaluations' }],
  KARYAWAN: [{ href: '/karyawan', label: 'My Dashboard' }, { href: '/assign', label: 'Team Evaluations' }],
  STUDENT: [{ href: '/student', label: 'Home' }],
  HRD: [{ href: '/hrd', label: 'HRD Dashboard' }, { href: '/assign', label: 'Assign Evaluators' }],
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
  // TK / SD principals and vice principals use the SD screens for teachers, so the generic screen is only for SMP / SMA (and Director, HRD, heads).
  // TK / SD principals have nothing to assign here; SD / TK teachers use My Evaluations instead of Team Evaluations.
  const sdGroup = level === 'SD' || level === 'TK';
  const tabs = (TABS[role] ?? []).filter(t => !(noSd && t.href.startsWith('/sd/')) && !(t.href === '/assign' && ((role === 'PRINCIPAL' && sdGroup) || (role === 'TEACHER' && sdGroup))));
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
