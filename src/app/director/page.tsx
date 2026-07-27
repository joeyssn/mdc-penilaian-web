'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type ReportRow = {
  id: string;
  name: string;
  role: string;
  department: string;
  studentCount: number;
  peerCount: number;
  selfCount: number;
  studentAvg: string;
  peerAvg: string;
  selfAvg: string;
  overallAvg: string;
};

export default function DirectorDashboard() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch('/api/director/report');
        const data = await res.json();
        if (!data.error) setReportData(data);
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print(); 
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans print:bg-white">
      
      {/* Navigation - Hidden during PDF generation via "print:hidden" */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200 print:hidden">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        <div className="flex gap-8">
          <Link href="/login" className="text-red-500 hover:text-red-700 font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-20 space-y-8 print:p-0 print:pt-4">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-[#053b50]">Director Overview</h1>
            <p className="text-gray-500 mt-2 font-medium print:hidden">School-wide evaluation performance metrics.</p>
            <p suppressHydrationWarning className="hidden print:block text-gray-500 mt-2 font-medium">Generated on: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          
          <button 
            onClick={handlePrint}
            className="bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 print:hidden flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Export to PDF
          </button>
        </div>

        {/* The Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500 font-bold">Generating Report...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                    <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Staff Name</th>
                    <th className="py-4 px-6 font-bold text-gray-600 uppercase text-xs tracking-wider">Role & Dept</th>
                    <th className="py-4 px-4 font-bold text-[#008c99] uppercase text-xs tracking-wider text-center">Student<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                    <th className="py-4 px-4 font-bold text-[#f39c12] uppercase text-xs tracking-wider text-center">Peer<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                    <th className="py-4 px-4 font-bold text-purple-600 uppercase text-xs tracking-wider text-center">Self<br/><span className="text-[10px] text-gray-400 font-normal">Count & Score</span></th>
                    <th className="py-4 px-6 font-bold text-gray-800 uppercase text-xs tracking-wider text-center">Overall Avg<br/><span className="text-[10px] text-gray-400 font-normal">(Scale 1-4)</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 print:hover:bg-transparent transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900">{row.name}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-700">{row.role}</span>
                          <span className="text-xs text-gray-500">{row.department}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.studentCount} done</span>
                          <span className={`font-extrabold ${row.studentAvg === '-' ? 'text-gray-300' : 'text-[#008c99]'}`}>{row.studentAvg}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.peerCount} done</span>
                          <span className={`font-extrabold ${row.peerAvg === '-' ? 'text-gray-300' : 'text-[#f39c12]'}`}>{row.peerAvg}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{row.selfCount} done</span>
                          <span className={`font-extrabold ${row.selfAvg === '-' ? 'text-gray-300' : 'text-purple-600'}`}>{row.selfAvg}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`font-extrabold text-lg ${row.overallAvg === '-' ? 'text-gray-300' : 'text-[#053b50]'}`}>
                          {row.overallAvg}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">No evaluation data found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}