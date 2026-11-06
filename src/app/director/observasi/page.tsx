'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Observation = {
  id: string; targetId: string; targetName: string; observerId: string; observerName: string;
  date: string; kelas: string; subject: string; duration: string; topic: string;
  scores: Record<string, number>; notesPositive: string; notesImprovement: string; finalScore: number;
};

export default function DirectorObservasiPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await fetch('/api/observasi');
    if (res.ok) {
      const data = await res.json();
      setObservations(data);
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading records...</div>;

  if (selectedObs) {
    return (
      <div className="min-h-screen bg-gray-200 py-10 print:bg-white print:py-0 font-serif">
        <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-md">
          <button onClick={() => setSelectedObs(null)} className="text-gray-600 font-bold bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200">← Back to List</button>
          <button onClick={handlePrint} className="bg-[#053b50] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#032635] flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Export to PDF
          </button>
        </div>

        <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 text-black">
          <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Instrumen Observasi Kelas</h1>
            <h2 className="text-xl font-bold mt-1">SMA Kristen Masa Depan Cerah</h2>
          </div>

          <table className="w-full mb-8 text-sm">
            <tbody>
              <tr><td className="w-48 font-bold py-1">Nama Guru (Observe)</td><td className="w-4">:</td><td className="py-1">{selectedObs.targetName}</td></tr>
              <tr><td className="w-48 font-bold py-1">Tanggal Pengamatan</td><td className="w-4">:</td><td className="py-1">{selectedObs.date}</td></tr>
              <tr><td className="w-48 font-bold py-1">Kelas</td><td className="w-4">:</td><td className="py-1">{selectedObs.kelas}</td></tr>
              <tr><td className="w-48 font-bold py-1">Bidang studi</td><td className="w-4">:</td><td className="py-1">{selectedObs.subject}</td></tr>
              <tr><td className="w-48 font-bold py-1">Lama Pengamatan</td><td className="w-4">:</td><td className="py-1">{selectedObs.duration}</td></tr>
              <tr><td className="w-48 font-bold py-1">Materi Pokok</td><td className="w-4">:</td><td className="py-1">{selectedObs.topic}</td></tr>
            </tbody>
          </table>

          <div className="mb-8 border border-black p-4 text-sm font-bold bg-gray-50 print:bg-transparent">
            Keterangan : 4 Sangat Baik | 3 Baik | 2 Cukup | 1 kurang | 0 sangat Kurang
          </div>

          <div className="mb-8 border border-black p-6 text-sm">
            <h3 className="font-bold text-lg mb-4 text-green-700 print:text-black">Hal Positif yang perlu dipertahankan:</h3>
            <p className="whitespace-pre-wrap">{selectedObs.notesPositive}</p>
          </div>

          <div className="mb-8 border border-black p-6 text-sm">
            <h3 className="font-bold text-lg mb-4 text-red-600 print:text-black">Hal yang perlu ditingkatkan:</h3>
            <p className="whitespace-pre-wrap">{selectedObs.notesImprovement}</p>
          </div>

          <div className="flex justify-between items-end mt-16 pt-8 text-sm text-center">
            <div>
              <p className="mb-16">Mengetahui,<br/>Kepala SMA Kr MDC</p>
              <p className="font-bold underline">Dra. Liem Sioe Ie</p>
            </div>
            
            <div className="text-right text-lg">
              <span className="font-bold">Nilai Akhir (NA): </span>
              <span className="text-3xl font-extrabold ml-2 border-b-2 border-black px-4">{selectedObs.finalScore.toFixed(2)}</span>
            </div>

            <div>
              <p className="mb-16">Surabaya, {selectedObs.date}<br/>Supervisor / Observer</p>
              <p className="font-bold underline">{selectedObs.observerName}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-10 w-auto" priority />
        <div className="flex gap-6 items-center">
          <Link href="/director" className="text-gray-600 font-bold hover:text-black">Director Dashboard</Link>
          <Link href="/login" className="text-red-500 font-bold hover:text-red-700">Logout</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#053b50]">Director Report: Instrumen Observasi</h1>
          <p className="text-gray-600 mt-1">Select a report below to view full details and Export to PDF.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {observations.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-500 font-bold bg-white rounded-2xl border border-gray-200">No observation records found.</div>
          ) : (
            observations.map(obs => (
              <div key={obs.id} onClick={() => setSelectedObs(obs)} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-[#008c99] hover:shadow-md transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{obs.date}</span>
                  <span className="bg-[#e99a24] text-white text-sm font-extrabold px-3 py-1 rounded-full">{obs.finalScore.toFixed(2)}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#008c99] transition-colors">{obs.targetName}</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">{obs.kelas} • {obs.subject}</p>
                
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
                  <span>By: {obs.observerName}</span>
                  <span className="text-[#008c99] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    View Report <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}