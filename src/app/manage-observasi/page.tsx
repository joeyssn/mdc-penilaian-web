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

export default function ManageObservasiPage() {
  const router = useRouter();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) { router.push('/login'); return; }
    
    const currentUser = await meRes.json();
    const role = (currentUser.role || '').toUpperCase();
    setUserRole(role);

    const obsRes = await fetch('/api/observasi');
    if (obsRes.ok) {
      const data = await obsRes.json();
      
      // 🚀 SMART FILTERING: Admin & Principal see all. VP only sees their own!
      if (role === 'ADMIN' || role === 'PRINCIPAL') {
        setObservations(data);
      } else {
        setObservations(data.filter((obs: Observation) => obs.observerId === currentUser.id));
      }
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this observation?")) return;
    
    const res = await fetch('/api/observasi', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (res.ok) {
      setObservations(prev => prev.filter(obs => obs.id !== id));
      alert("Deleted successfully!");
    } else {
      alert("Failed to delete record.");
    }
  };

  // 🚀 PRINCIPAL APPROVAL LOGIC
  const handleToggleApproval = async (recordId: string, newStatus: boolean) => {
    const actionText = newStatus ? "Approve" : "Batalkan Approve";
    if (!confirm(`Apakah Anda yakin ingin ${actionText} observasi ini?`)) return;
    
    try {
      const res = await fetch('/api/observasi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId, isApproved: newStatus })
      });
      if (res.ok) {
        setObservations(prev => prev.map(obs => obs.id === recordId ? { ...obs, isApproved: newStatus } : obs));
      } else {
        alert("Gagal mengubah status approval.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getDashboardLink = () => {
    if (userRole === 'PRINCIPAL') return '/principal';
    if (userRole === 'VICE_PRINCIPAL_KURIKULUM') return '/vice-principal';
    if (userRole === 'ADMIN') return '/admin';
    return '/login';
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Memuat data...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-10 w-auto" priority />
        <div className="flex gap-6 items-center">
          <Link href={getDashboardLink()} className="text-gray-600 font-bold hover:text-black">Dashboard</Link>
          <Link href="/login" className="text-red-500 font-bold hover:text-red-700">Logout</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Kelola Observasi Kelas</h1>
            <p className="text-gray-600 mt-1">
              {userRole === 'PRINCIPAL' ? 'Daftar riwayat observasi untuk disetujui.' : 'Daftar riwayat observasi yang telah Anda lakukan.'}
            </p>
          </div>
          <Link href="/instrumen-observasi" className="bg-[#008c99] hover:bg-[#007b87] text-white px-6 py-3 rounded-lg font-bold shadow-md transition-all text-center">
            + Buat Observasi Baru
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wide">
                  <th className="p-4 font-bold border-b border-gray-200">Tanggal</th>
                  <th className="p-4 font-bold border-b border-gray-200">Guru (Target)</th>
                  <th className="p-4 font-bold border-b border-gray-200">Diperiksa Oleh</th>
                  <th className="p-4 font-bold border-b border-gray-200">Nilai</th>
                  <th className="p-4 font-bold border-b border-gray-200">Status</th>
                  <th className="p-4 font-bold border-b border-gray-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {observations.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-bold">Belum ada data observasi.</td></tr>
                ) : (
                  observations.map(obs => (
                    <tr key={obs.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium whitespace-nowrap">{obs.date}</td>
                      <td className="p-4 font-bold text-[#053b50]">{obs.targetName}<br/><span className="text-xs text-gray-400 font-normal">{obs.kelas}</span></td>
                      <td className="p-4 text-gray-600 text-sm">{obs.observerName}</td>
                      <td className="p-4"><span className="bg-[#e99a24] text-white px-3 py-1 rounded-full font-bold text-sm">{obs.finalScore.toFixed(2)}</span></td>
                      
                      <td className="p-4">
                        {obs.isApproved ? (
                          <span className="bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded text-xs font-bold">Approved</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-1 rounded text-xs font-bold">Pending</span>
                        )}
                      </td>

                      <td className="p-4 flex justify-end gap-2">
                        {/* 🚀 THE PRINCIPAL CAN APPROVE/UNAPPROVE RIGHT HERE */}
                        {userRole === 'PRINCIPAL' && (
                          !obs.isApproved ? (
                            <button onClick={() => handleToggleApproval(obs.id, true)} className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded font-bold text-sm transition-colors">
                              Approve
                            </button>
                          ) : (
                            <button onClick={() => handleToggleApproval(obs.id, false)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded font-bold text-sm transition-colors">
                              Unapprove
                            </button>
                          )
                        )}
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