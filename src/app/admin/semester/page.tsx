'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SemesterManagementPage() {
  const [currentSemester, setCurrentSemester] = useState('Ganjil 2026/2027');
  const [newSemester, setNewSemester] = useState('Genap 2026/2027');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleBulkReset = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/semester/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSemester, newSemester }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        setShowConfirmModal(false);
        setCurrentSemester(newSemester);
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to process semester reset.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center border-b border-gray-200">
        <h1 className="text-xl font-extrabold text-[#053b50]">Admin Master Panel</h1>
        <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">
          ← Back to Overview
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#053b50]">End of Semester Reset</h1>
          <p className="text-gray-500 mt-2 font-medium">
            Archive active rubric scores, evaluation logs, observations, and attendance for the current term, then wipe tables for the new term.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Active Semester (To Archive)
              </label>
              <input
                type="text"
                value={currentSemester}
                onChange={(e) => setCurrentSemester(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-bold text-gray-800 outline-none focus:border-[#008c99]"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                New Semester (Incoming)
              </label>
              <input
                type="text"
                value={newSemester}
                onChange={(e) => setNewSemester(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-bold text-gray-800 outline-none focus:border-[#008c99]"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium">
            ⚠️ <strong>Notice:</strong> This action will safely move all entries from <code className="font-mono">score</code>, <code className="font-mono">evaluationlog</code>, <code className="font-mono">Observation</code>, and <code className="font-mono">Absence</code> into <code className="font-mono">SemesterArchive</code>, resetting the evaluation system for <strong>{newSemester}</strong>.
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-4 px-6 rounded-xl shadow-md transition-all text-center"
          >
            Archive {currentSemester} & Clear Active Scores
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
            <h2 className="text-2xl font-extrabold text-red-600">Confirm Semester Reset</h2>
            <p className="text-gray-600 font-medium leading-relaxed">
              Are you sure you want to finalize <strong>{currentSemester}</strong>? All active rubric scores, evaluation logs, observations, and attendance will be archived and cleared.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReset}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Archiving & Resetting...' : 'Yes, Complete Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}