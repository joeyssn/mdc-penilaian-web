'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Observation = {
  id: string; targetId: string; targetName: string; observerId: string; observerName: string;
  date: string; kelas: string; subject: string; duration: string; topic: string;
  scores: Record<string, number>; notesPositive: string; notesImprovement: string; finalScore: number;
  isApproved: boolean; // 🚀 ADDED TO TYPE
};

export default function AdminTrackRecordPage() {
  const router = useRouter();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.role?.toUpperCase() !== 'ADMIN') {
        router.push('/login');
        return;
      }
    } else {
      router.push('/login');
      return;
    }

    const obsRes = await fetch('/api/observasi');
    if (obsRes.ok) {
      const data = await obsRes.json();
      setObservations(data);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this observation record?")) return;
    
    const res = await fetch('/api/observasi', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (res.ok) {
      setObservations(prev => prev.filter(obs => obs.id !== id));
      alert("Record deleted successfully!");
    } else {
      alert("Failed to delete record.");
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading Track Record...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
          <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Go back to Live Overview</Link>
          </div>
          
          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Observation Track Record</h1>
            <p className="text-gray-600 mt-1">Full database of all manual observations done by Principals & VPs.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wide">
                  <th className="p-4 font-bold border-b border-gray-200">Tanggal</th>
                  <th className="p-4 font-bold border-b border-gray-200">Guru (Target)</th>
                  <th className="p-4 font-bold border-b border-gray-200">Kelas / Topik</th>
                  <th className="p-4 font-bold border-b border-gray-200">Diperiksa Oleh</th>
                  <th className="p-4 font-bold border-b border-gray-200">Nilai</th>
                  <th className="p-4 font-bold border-b border-gray-200">Status</th>
                  <th className="p-4 font-bold border-b border-gray-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {observations.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500 font-bold">Belum ada data observasi.</td></tr>
                ) : (
                  observations.map(obs => (
                    <tr key={obs.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium whitespace-nowrap">{obs.date}</td>
                      <td className="p-4 font-bold text-[#053b50]">{obs.targetName}</td>
                      <td className="p-4 text-gray-600">{obs.kelas} <br/><span className="text-xs text-gray-400">{obs.topic}</span></td>
                      <td className="p-4 text-gray-600 text-sm">{obs.observerName}</td>
                      <td className="p-4"><span className="bg-[#e99a24] text-white px-3 py-1 rounded-full font-bold text-sm">{obs.finalScore.toFixed(2)}</span></td>
                      
                      {/* 🚀 NEW STATUS COLUMN */}
                      <td className="p-4">
                        {obs.isApproved ? (
                          <span className="bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded text-xs font-bold">Approved</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-1 rounded text-xs font-bold">Pending</span>
                        )}
                      </td>

                      <td className="p-4 flex justify-end gap-2">
                        <Link href={`/instrumen-observasi?id=${obs.id}`} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded font-bold text-sm transition-colors">
                          Edit
                        </Link>
                        <button onClick={() => handleDelete(obs.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded font-bold text-sm transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}