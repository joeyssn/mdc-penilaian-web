'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Backup = {
  id: string;
  filename: string;
  createdAt: string;
  size: string;
  type: 'AUTO' | 'MANUAL';
  status: 'READY' | 'CORRUPTED';
};

export default function SystemRecoveryPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal States
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/backups');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setBackups(data);
      } else {
        setBackups([]);
      }
    } catch (error) {
      console.error("Failed to fetch backups:", error);
      setBackups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        alert('New system backup created successfully.');
        fetchBackups(); // Refresh the list
      } else {
        alert(data.error || 'Failed to create backup.');
      }
    } catch (error) {
      alert('Network error while creating backup.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'RESTORE') {
      alert('Please type RESTORE to confirm.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/backups/restore`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedBackup?.filename }) 
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('System successfully restored! The page will now reload.');
        window.location.reload(); 
      } else {
        alert(data.error || 'Failed to restore backup.');
        setIsProcessing(false);
      }
    } catch (error) {
      alert('Critical Error during restoration. Please check server logs.');
      setIsProcessing(false);
    }
  };

  const openRestoreModal = (backup: Backup) => {
    setSelectedBackup(backup);
    setConfirmText('');
    setIsRestoreModalOpen(true);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans">
      
      {/* Navbar */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
          <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Back to Dashboard</Link>
          </div>
          <Link href="/login" className="text-gray-500 hover:text-gray-700 text-[15px] font-bold transition-colors">Logout</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6 pb-20">
        
        {/* Header & Warnings */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
          <div className="bg-red-100 p-3 rounded-full text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-800">System Recovery & Rollback</h2>
            <p className="text-red-700 mt-1 text-sm leading-relaxed">
              Restoring a previous backup will overwrite the current live database. Any data entered <strong>after</strong> the selected backup timestamp will be permanently lost. Always create a new manual backup before initiating a restore.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Available Restore Points</h3>
          <button 
            onClick={handleCreateBackup}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-[#008c99] hover:bg-[#00737d] text-white font-bold py-2.5 px-6 rounded-xl transition-transform active:scale-95 shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            {isProcessing ? 'Generating Backup...' : 'Create Manual Backup'}
          </button>
        </div>

        {/* Backup Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Timestamp</th>
                  <th className="px-6 py-4 font-bold">File Name</th>
                  <th className="px-6 py-4 font-bold">Type</th>
                  <th className="px-6 py-4 font-bold">Size</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">Loading system backups...</td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">No backups found on server.</td>
                  </tr>
                ) : (
                  backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">{formatDate(backup.createdAt)}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">
                        {backup.filename}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          backup.type === 'AUTO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {backup.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-500">
                        {backup.size}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openRestoreModal(backup)}
                          className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ml-auto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Restore Point
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

      {/* Strict Confirmation Modal */}
      {isRestoreModalOpen && selectedBackup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border-t-4 border-red-500">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-xl text-red-600 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Danger: Overwrite Live Data
              </h2>
              <button type="button" onClick={() => setIsRestoreModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleRestore} className="p-6">
              <div className="bg-gray-50 p-4 rounded-xl mb-6 text-sm text-gray-700 leading-relaxed border border-gray-200">
                You are about to roll back the system to:
                <br /><strong className="text-gray-900 block mt-2 text-base">{selectedBackup.filename}</strong>
                <strong className="text-gray-900 block">{formatDate(selectedBackup.createdAt)}</strong>
                <br />
                All database entries created <strong>after</strong> this exact timestamp will be permanently deleted and cannot be recovered.
              </div>

              <div className="mb-6">
                <label className="text-sm font-bold text-gray-700 mb-2 block">
                  To proceed, please type <span className="text-red-500 select-none">RESTORE</span> below:
                </label>
                <input 
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESTORE here"
                  className="w-full bg-white border-2 border-gray-200 rounded-xl py-3 px-4 text-gray-900 outline-none focus:border-red-500 transition-colors font-mono"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={confirmText !== 'RESTORE' || isProcessing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isProcessing ? 'Restoring System...' : 'Confirm Rollback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}