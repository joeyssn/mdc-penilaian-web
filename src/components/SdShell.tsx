'use client';

import RoleNav from '@/components/RoleNav';
import type { ReactNode } from 'react';

// Same top bar, background and spacing as the other dashboards, so the SD screens feel like part of the site.
export default function SdShell({ title, subtitle, children }: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans text-gray-900 [color-scheme:light] [&_input]:text-gray-900 [&_select]:text-gray-900 [&_select]:bg-white [&_option]:text-gray-900 [&_table]:text-gray-900">
      <RoleNav />
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
