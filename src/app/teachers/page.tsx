import Image from 'next/image';
import Link from 'next/link';
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function TeacherHomepage() {
  // 1. Grab the first available teacher to act as our "logged in" user for now
  const loggedInUser = await prisma.user.findFirst({
    where: { role: 'TEACHER' }
  });

  const loggedInTeacherName = loggedInUser?.name || "Budi Santoso";
  const targetId = loggedInUser?.id || "fallback-id";

  // 2. FETCH DATA: Use the EXACT column names from your error log (targetId)
  const allScores = await prisma.score.findMany({
    where: {
      targetId: targetId
    }
  });

  // 3. CALCULATE AVERAGES using the exact 'value' column
  const totalScores = allScores.length;
  const overallAverage = totalScores > 0 
    // We wrap Number() around s.value just in case Prisma treats your enum as text
    ? (allScores.reduce((sum, s) => sum + Number(s.value), 0) / totalScores).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-[#F7F7F7] font-sans pb-20">
      
      {/* Navigation Bar */}
      <nav className="bg-white py-5 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
           <Image 
            src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" 
            alt="MDC Christian School" 
            width={300} 
            height={70} 
            className="h-10 md:h-12 w-auto"
            priority
          />
        </div>
        
        <div className="hidden md:flex gap-10 text-[15px] font-medium text-gray-800">
          <Link href="/teacher" className="text-black border-b-2 border-black pb-1">Home</Link>
          <Link href="/teacher/staff" className="hover:text-black transition-colors">Teacher / Staff</Link>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto px-6 md:px-12 pt-12 space-y-6">
        
        <h1 className="text-4xl md:text-[42px] font-extrabold text-[#084a53] tracking-tight mb-8">
          Hi, Welcome {loggedInTeacherName}
        </h1>

        <div className="bg-[#ef9919] rounded-xl p-8 flex justify-between items-center shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-2xl md:text-[26px] font-bold text-white mb-1">Overall Evaluation Rating</h2>
            <p className="text-white text-sm font-medium">Based on {totalScores} peer responses</p>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-baseline">
              <span className="text-[64px] font-extrabold text-white leading-none mb-1">
                {overallAverage}
              </span>
            </div>
            <span className="text-white text-sm font-medium pr-1">out of 4.0</span>
          </div>
        </div>

        {/* Class Ratings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between h-[220px]">
            <div>
              <h3 className="text-[26px] font-extrabold text-black tracking-tight">Bahasa Indonesia</h3>
              <p className="text-gray-800 font-medium text-base mt-1">Class Rating</p>
            </div>
            <div className="mt-auto">
              <div className="flex justify-between items-end mb-3">
                <div className="flex items-baseline font-extrabold text-gray-500">
                  <span className="text-4xl">{overallAverage}</span><span className="text-xl">/4.0</span>
                </div>
                <span className="text-gray-500 font-bold text-[15px]">({totalScores} evaluations)</span>
              </div>
              <div className="w-full h-4 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(Number(overallAverage) / 4) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between h-[220px]">
            <div>
              <h3 className="text-[26px] font-extrabold text-black tracking-tight">Chemistry</h3>
              <p className="text-gray-800 font-medium text-base mt-1">Class Rating</p>
            </div>
            <div className="mt-auto">
              <div className="flex justify-between items-end mb-3">
                <div className="flex items-baseline font-extrabold text-[#008c99]">
                  <span className="text-4xl">{overallAverage}</span><span className="text-xl">/4.0</span>
                </div>
                <span className="text-[#008c99] font-bold text-[15px]">({totalScores} evaluations)</span>
              </div>
              <div className="w-full h-4 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div className="h-full bg-[#008c99] rounded-full" style={{ width: `${(Number(overallAverage) / 4) * 100}%` }}></div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}