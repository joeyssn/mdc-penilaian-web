'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans">
      
      {/* Navigation Bar */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
           <Image 
            src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" 
            alt="MDC Christian School" 
            width={220} 
            height={55} 
            className="h-10 md:h-12 w-auto"
            priority
          />
        </div>
        
        {/* Navigation Links & Logout */}
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-10 text-[15px] font-medium text-gray-600">
            <Link href="/admin" className="text-black border-b-2 border-black pb-1">
              Home
            </Link>
            <Link href="/admin/teachers" className="hover:text-black transition-colors">
              Teacher / Staff
            </Link>
            <Link href="/admin/rubric" className="hover:text-black transition-colors">
              Rubric
            </Link>
          </div>

          <Link 
            href="/login" 
            className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2 rounded-lg text-sm font-bold transition-colors border border-red-200"
          >
            Logout
          </Link>
        </div>
      </nav>

      {/* Main Dashboard Grid */}
      <main className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Row: Demographic Dashboards */}
          <DemographicCard title="Dashboard MDC Campus 2026-1" />
          <DemographicCard title="Dashboard MDC Campus 2026-2" />

          {/* Bottom Row: Assessment Dashboards */}
          <AssessmentCard title="Dashboard Penilaian MDC Campus 2026-1" />
          <AssessmentCard title="Dashboard Penilaian MDC Campus 2026-2" />
          
        </div>
      </main>
    </div>
  );
}

// ==========================================
// REUSABLE CARD COMPONENTS
// ==========================================

function DemographicCard({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col">
      {/* Teal Header */}
      <div className="bg-[#008c99] text-white px-6 py-4 font-bold text-lg">
        {title}
      </div>
      
      {/* Card Content */}
      <div className="p-8 flex flex-col sm:flex-row items-center justify-center gap-12 sm:gap-20">
        
        {/* CSS-Only Pie Chart */}
        <div 
          className="w-48 h-48 rounded-full relative shadow-inner"
          style={{ background: 'conic-gradient(from -30deg, #000000 0% 15%, #008c99 15% 40%, #f39c12 40% 100%)' }}
        >
           {/* Chart Labels manually positioned to match design */}
           <span className="absolute top-[35%] right-[12%] text-white font-bold text-sm">15%</span>
           <span className="absolute bottom-[20%] right-[30%] text-white font-bold text-sm">25%</span>
           <span className="absolute top-[45%] left-[20%] text-white font-bold text-lg">60%</span>
        </div>
        
        {/* Legend / Stats */}
        <div className="space-y-4 font-bold text-lg">
          <div className="text-[#f39c12]">Total Students: 623</div>
          <div className="text-[#008c99]">Total Teachers: 42</div>
          <div className="text-black">Total Staff: 20</div>
        </div>
      </div>
    </div>
  );
}

function AssessmentCard({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col">
      {/* Teal Header */}
      <div className="bg-[#008c99] text-white px-6 py-4 font-bold text-lg">
        {title}
      </div>
      
      {/* Card Content */}
      <div className="p-8 flex flex-col sm:flex-row items-center justify-center gap-12 sm:gap-20">
        
        {/* CSS-Only Pie Chart */}
        <div 
          className="w-48 h-48 rounded-full relative shadow-inner"
          style={{ background: 'conic-gradient(from 110deg, #e81c1c 0% 45%, #2a2aff 45% 100%)' }}
        >
           {/* Chart Labels */}
           <span className="absolute bottom-[20%] right-[35%] text-white font-bold text-sm">45%</span>
           <span className="absolute top-[35%] left-[40%] text-white font-bold text-lg">55%</span>
        </div>
        
        {/* Legend / Stats */}
        <div className="space-y-6 font-bold text-lg">
          <div className="text-[#2a2aff]">
            Total Sudah<br/>memberi nilai: 421
          </div>
          <div className="text-[#e81c1c]">
            Total belum<br/>memberi nilai: 200
          </div>
        </div>
      </div>
    </div>
  );
}   