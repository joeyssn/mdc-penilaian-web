'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- TYPES ---
type User = { id: string; name: string; role: string; gender?: string | null; };
type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
// 🚀 ADDED isSelfReflection to the Rubric type!
type Rubric = { id: string; title: string; isSelfReflection?: boolean; evaluators: string[]; evaluatees: string[]; sections: Section[] };

export default function SelfReflectionPage() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Fetch Logged In User
    const meRes = await fetch('/api/me');
    if (!meRes.ok) return router.push('/login');
    const meData = await meRes.json();
    if (meData.role === 'STUDENT') return router.push('/student'); // students have no self-reflection
    setLoggedInUser(meData);

    // 2. Check if they already completed their self-reflection
    const compRes = await fetch(`/api/evaluate/completed?graderId=${meData.id}`);
    if (compRes.ok) {
      const compData = await compRes.json();
      // If their own ID is in the completed list, they already did their self-reflection!
      if (compData.includes(meData.id)) {
        setHasCompleted(true);
      }
    }

    // 3. Fetch Rubrics
    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    if (!rData.error && rData.length > 0) {
      setRubrics(rData);
    }
  };

  const getTitle = (gender?: string | null) => gender === 'Laki-Laki' ? 'Mr. ' : gender === 'Perempuan' ? "Ma'am " : '';

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return 'Staff';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff';
    if (upper === 'KARYAWAN') return 'Karyawan'; 
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper.includes('VICE_PRINCIPAL') || upper === 'VICE-PRINCIPAL') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return 'Staff';
  };

  const handleScoreChange = (indicatorId: string, value: number) => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!loggedInUser) return;
    const scoreArray = Object.entries(scores).map(([indicatorId, value]) => ({ indicatorId, value }));

    if (scoreArray.length === 0) {
      alert("Please score at least one indicator before submitting.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Target ID is their OWN ID for Self-Reflection!
        body: JSON.stringify({ graderId: loggedInUser.id, targetId: loggedInUser.id, scores: scoreArray }),
      });

      if (res.ok) {
        alert("Self-Reflection submitted successfully!");
        setHasCompleted(true);
      } else {
        alert("Failed to submit self-reflection.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 FOOLPROOF SELF-REFLECTION MATCHER
  let activeRubric: Rubric | null = null;
  if (loggedInUser) {
    const myRole = getNormalizedRole(loggedInUser.role);
    
    activeRubric = rubrics.find(r => 
      r.evaluators?.includes(myRole) && 
      r.evaluatees?.includes(myRole) &&
      r.isSelfReflection === true // 🚀 ONLY loads if the Admin ticked the checkbox!
    ) || null;
  }

  // Figure out the correct back link based on their role
  const getBackLink = () => {
    if (!loggedInUser) return '/login';
    const r = loggedInUser.role.toUpperCase();
    if (r === 'TEACHER') return '/teachers';
    if (r === 'KARYAWAN') return '/karyawan';
    if (r === 'HRD' || r === 'STAFF') return '/staff';
    if (r.includes('VICE_PRINCIPAL')) return '/vice-principal';
    if (r === 'PRINCIPAL') return '/principal';
    if (r === 'DIRECTOR') return '/director';
    if (r === 'ADMIN') return '/admin';
    return '/login';
  };

  if (hasCompleted) {
    return (
      <div className="min-h-screen bg-[#f7f8f9] font-sans flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-lg border border-gray-200">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold text-[#053b50] mb-4">Self-Reflection Completed!</h2>
          <p className="text-gray-600 mb-8">Thank you for completing your self-reflection. Your responses have been securely saved.</p>
          <Link href={getBackLink()} className="bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        <Link href={getBackLink()} className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Back to Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Self-Reflection Portal</h1>
          <p className="text-gray-500 mt-3 text-lg">Evaluate your own performance and personal growth.</p>
        </div>

        {!activeRubric ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center shadow-sm mt-8">
            <h3 className="text-lg font-bold text-red-700">No Self-Reflection Rubric Assigned</h3>
            <p className="text-red-600 mt-2">The admin has not assigned a self-reflection rubric for your specific role yet.</p>
            <Link href={getBackLink()} className="inline-block mt-6 bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-red-700">Go Back</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mt-8">
            <div className="bg-[#053b50] px-8 py-6 text-white text-center">
              <h2 className="text-2xl font-extrabold tracking-tight">{activeRubric.title}</h2>
              {loggedInUser && <p className="text-gray-300 mt-2">Completing as: {getTitle(loggedInUser.gender)}{loggedInUser.name}</p>}
            </div>

            <form onSubmit={submitEvaluation} className="p-6 md:p-10 space-y-10 bg-gray-50">
              {(activeRubric.sections || []).map((section) => (
                <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 text-lg">{section.title}</h3>
                  </div>
                  
                  <div className="p-6 space-y-8">
                    {(section.categories || []).map((category) => (
                      <div key={category.id} className="space-y-4">
                        <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm border-b border-gray-100 pb-2">{category.title}</h4>
                        <div className="space-y-4">
                          {(category.indicators || []).map((indicator) => (
                            <div key={indicator.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                              <p className="text-gray-800 font-medium md:w-2/3 leading-relaxed">{indicator.text}</p>
                              <div className="flex gap-2 shrink-0 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
                                {[1, 2, 3, 4].map((val) => (
                                  <label key={val} className={`flex items-center justify-center w-12 h-12 rounded-md cursor-pointer font-bold text-lg transition-all ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}>
                                    <input type="radio" name={indicator.id} value={val} className="hidden" onChange={() => handleScoreChange(indicator.id, val)} required />
                                    {val}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
               ))}
              
              <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-sm text-gray-500 font-medium">*You can only submit your self-reflection once.</p>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#e99a24] hover:bg-[#d68a1f] text-white font-extrabold text-lg px-12 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Saving...' : 'Submit Self-Reflection'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}