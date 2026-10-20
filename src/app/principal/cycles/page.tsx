'use client';

import Link from 'next/link';
import CycleLockPanel from '@/components/CycleLockPanel';

export default function PrincipalCyclesPage() {
  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-end border-b border-gray-200">
        <Link href="/principal" className="text-gray-500 hover:text-[#008c99] font-bold">← Back to Dashboard</Link>
      </nav>
      <div className="max-w-4xl mx-auto px-6 pt-10 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Score Visibility</h1>
          <p className="text-gray-500 mt-2 font-medium">Unlock or lock results for an evaluation cycle. Every change is recorded.</p>
        </div>
        <CycleLockPanel canManage={false} />
      </div>
    </div>
  );
}
