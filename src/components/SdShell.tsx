'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Same top bar, background and spacing as the other dashboards, so the SD screens feel like part of the site.
export default function SdShell({ title, subtitle, home, tabs, children }: {
  title: string; subtitle?: string; home: string; tabs: { href: string; label: string }[]; children: ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans text-gray-900 [color-scheme:light] [&_input]:text-gray-900 [&_select]:text-gray-900 [&_select]:bg-white [&_option]:text-gray-900 [&_table]:text-gray-900">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 gap-4">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        <div className="flex gap-8 text-[15px] font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Link href={home} className="pb-1 border-b-2 border-transparent text-gray-500 hover:text-[#053b50] transition-all">My Dashboard</Link>
          {tabs.map(t => (
            <Link key={t.href} href={t.href} className={`pb-1 transition-all border-b-2 ${path === t.href ? 'text-[#053b50] border-[#008c99]' : 'border-transparent text-gray-500 hover:text-[#053b50]'}`}>{t.label}</Link>
          ))}
        </div>
        <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
      </nav>
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-20 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-2 text-sm md:text-base">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
