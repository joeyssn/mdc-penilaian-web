'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminSettingsPage() {
  const [weights, setWeights] = useState({ studentWeight: 30, peerWeight: 40, observationWeight: 30 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/weights')
      .then(res => res.json())
      .then(data => setWeights({ studentWeight: data.studentWeight, peerWeight: data.peerWeight, observationWeight: data.observationWeight }));
  }, []);

  const total = weights.studentWeight + weights.peerWeight + weights.observationWeight;

  const handleSave = async () => {
    if (total !== 100) return alert("Total percentage must equal exactly 100%!");
    setIsSaving(true);
    const res = await fetch('/api/settings/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights)
    });
    if (res.ok) alert("Scoring Weights Updated Successfully!");
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 shadow-sm flex justify-between items-center border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={200} height={50} className="h-10 w-auto" priority />
        <Link href="/admin" className="text-gray-600 font-bold hover:text-black">Back to Admin</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#053b50]">Rubric Scoring Weights</h1>
          <p className="text-gray-600 mt-1">Determine the percentage impact of each evaluation type.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="space-y-2">
            <label className="font-bold text-gray-700 flex justify-between">Student Evaluation Impact <span>{weights.studentWeight}%</span></label>
            <input type="range" min="0" max="100" value={weights.studentWeight} onChange={(e) => setWeights({ ...weights, studentWeight: Number(e.target.value) })} className="w-full accent-[#008c99]" />
          </div>
          <div className="space-y-2">
            <label className="font-bold text-gray-700 flex justify-between">Peer Evaluation Impact <span>{weights.peerWeight}%</span></label>
            <input type="range" min="0" max="100" value={weights.peerWeight} onChange={(e) => setWeights({ ...weights, peerWeight: Number(e.target.value) })} className="w-full accent-[#f39c12]" />
          </div>
          <div className="space-y-2">
            <label className="font-bold text-gray-700 flex justify-between">Observation Impact (Principal/VP) <span>{weights.observationWeight}%</span></label>
            <input type="range" min="0" max="100" value={weights.observationWeight} onChange={(e) => setWeights({ ...weights, observationWeight: Number(e.target.value) })} className="w-full accent-green-600" />
          </div>

          <div className={`p-4 rounded-lg font-bold text-center text-lg ${total === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            Total: {total}% {total !== 100 && "(Must be 100%)"}
          </div>

          <button onClick={handleSave} disabled={total !== 100 || isSaving} className="w-full bg-[#053b50] hover:bg-[#032635] text-white font-bold py-4 rounded-xl shadow-md transition-all disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Percentages'}
          </button>
        </div>
      </div>
    </div>
  );
}