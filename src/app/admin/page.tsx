'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ChartData = { name: string; value: number; fill: string };
type Totals = {
  totalStudents: number;
  activeStudents: number;
  totalTeachersStaff: number;
  activeTeachersStaff: number;
  overallTotal: number;
  overallActive: number;
};

export default function AdminDashboard() {
  const [studentData, setStudentData] = useState<ChartData[]>([]);
  const [teacherData, setTeacherData] = useState<ChartData[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');

        if (!res.ok) {
          throw new Error(`API returned status: ${res.status}`);
        }

        const data = await res.json();

        if (!data.error) {
          setStudentData(data.studentStats);
          setTeacherData(data.teacherStats);
          setTotals(data.totals);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
          <p className="font-bold text-gray-800">{payload[0].name}</p>
          <p className="text-gray-600">{payload[0].value} Users</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">

      {/* Navigation */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>

        <div className="flex items-center gap-10">
          {/* Admin Navigation Links */}
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
            <Link href="/admin" className="text-[#053b50] border-b-2 border-[#008c99] pb-1 transition-all">
              Overview
            </Link>
            <Link href="/admin/teachers" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Teachers/Staff
            </Link>
            <Link href="/admin/rubric" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Rubrics
            </Link>
            <Link href="/admin/observasi-template" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Edit Observasi Questions
            </Link>
            <Link href="/admin/observasi" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Observasi Status
            </Link>
          </div>


          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold text-[#053b50]">Admin Overview</h1>
          <p className="text-gray-500 mt-2 font-medium">Track evaluation completion rates across the school.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008c99]"></div>
          </div>
        ) : (
          <>
            {/* TOTAL NUMBERS SUMMARY CARDS */}
            {totals && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                {/* Overall Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Overall Completion</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#053b50]">{totals.overallActive}</span>
                    <span className="text-xl font-bold text-gray-400 mb-1">/ {totals.overallTotal}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">Total users who submitted evaluations</p>
                </div>

                {/* Students Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#008c99]/20 bg-[#008c99]/5 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-[#008c99] uppercase tracking-wider mb-2">Student Submissions</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#008c99]">{totals.activeStudents}</span>
                    <span className="text-xl font-bold text-[#008c99]/50 mb-1">/ {totals.totalStudents}</span>
                  </div>
                  <p className="text-sm text-[#008c99]/70 mt-2 font-medium">Total students participating</p>
                </div>

                {/* Teachers Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#d49a37]/20 bg-[#d49a37]/5 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-[#d49a37] uppercase tracking-wider mb-2">Teacher & Staff Submissions</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-[#d49a37]">{totals.activeTeachersStaff}</span>
                    <span className="text-xl font-bold text-[#d49a37]/50 mb-1">/ {totals.totalTeachersStaff}</span>
                  </div>
                  <p className="text-sm text-[#d49a37]/70 mt-2 font-medium">Total staff participating</p>
                </div>

              </div>
            )}

            {/* PIE CHARTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Student Breakdown</h2>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={studentData}
                        cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value"
                        animationBegin={0} animationDuration={1500}
                      >
                        {studentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Teacher & Staff Breakdown</h2>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={teacherData}
                        cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value"
                        animationBegin={200} animationDuration={1500}
                      >
                        {teacherData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 