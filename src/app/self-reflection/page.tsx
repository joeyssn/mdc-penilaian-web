'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  name: string;
  role: string;
  gender?: string | null;
};

type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { 
  id: string; 
  title: string; 
  evaluators: string[]; // <--- Added so the rule checker works
  evaluatees: string[]; // <--- Added so the rule checker works
  sections: Section[] 
};

export default function SelfReflectionPage() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [activeRubric, setActiveRubric] = useState<Rubric | null>(null);
  
  const [hasCompletedThisYear, setHasCompletedThisYear] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  const [scores, setScores] = useState<Record<string, 'A'|'B'|'C'|'D'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const meRes = await fetch('/api/me');
      if (!meRes.ok) throw new Error("Not logged in");
      const meData = await meRes.json();
      setLoggedInUser(meData);

      const rRes = await fetch('/api/rubric');
      if (rRes.ok) {
        const rData = await rRes.json();
        
        // 🚀 THE NEW RULE CHECKER
        const isSelfReflectionRule = (r: Rubric) => {
          const requiredRoles = ["Teacher", "Staff", "Director/Principal"];
          const excludedRoles = ["Admin", "Student"];
          
          const hasRequired = requiredRoles.every(role => r.evaluators?.includes(role) && r.evaluatees?.includes(role));
          const hasExcluded = excludedRoles.some(role => r.evaluators?.includes(role) || r.evaluatees?.includes(role));
          
          return hasRequired && !hasExcluded;
        };

        // Find the rubric using the strict Access Rules (or fallback to the first one if not found)
        const selfRubric = rData.find((r: Rubric) => isSelfReflectionRule(r)) || rData[0];
        setActiveRubric(selfRubric);

        if (selfRubric) {
          // Extract all question IDs
          const indicatorIds: string[] = [];
          selfRubric.sections?.forEach((sec: any) => {
            sec.categories?.forEach((cat: any) => {
              cat.indicators?.forEach((ind: any) => {
                indicatorIds.push(ind.id);
              });
            });
          });

          // Check completion status for this specific rubric
          const statusRes = await fetch(`/api/evaluate/self-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: meData.id, indicatorIds })
          });
          
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setHasCompletedThisYear(statusData.hasCompletedThisYear);
            setCurrentYear(statusData.year);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (gender?: string | null) => {
    if (gender === 'Laki-Laki') return 'Mr. ';
    if (gender === 'Perempuan') return "Ma'am ";
    return '';
  };

  const handleScoreChange = (indicatorId: string, value: 'A'|'B'|'C'|'D') => {
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
        body: JSON.stringify({
          graderId: loggedInUser.id,
          targetId: loggedInUser.id,
          scores: scoreArray
        }),
      });

      if (res.ok) {
        alert("Self-Reflection submitted successfully!");
        setHasCompletedThisYear(true); 
      } else {
        alert("Failed to submit evaluation.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading your profile...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center cursor-pointer" onClick={() => router.back()}>
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        <div className="flex items-center gap-10">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-black font-medium transition-colors">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-20 space-y-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-[#053b50] mb-3">Annual Self-Reflection</h1>
          <p className="text-gray-600 text-lg">Reviewing your own performance and goals for {currentYear}.</p>
        </div>

        {hasCompletedThisYear ? (
          <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-10 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-green-800 mb-2">Reflection Completed!</h2>
            <p className="text-green-700 text-lg font-medium">Thank you, {getTitle(loggedInUser?.gender)}{loggedInUser?.name}. You have already submitted your self-reflection for the {currentYear} calendar year.</p>
            <button onClick={() => router.back()} className="mt-8 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95">
              Return to Dashboard
            </button>
          </div>
        ) : (
          activeRubric && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-[#053b50] px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: Myself</h2>
                  <p className="text-[#053b50] text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 font-medium">Rubric: {activeRubric.title}</p>
                </div>
              </div>

              <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
                {(activeRubric.sections || []).map((section) => (
                  <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-6 py-3 border-b border-gray-200"><h3 className="font-bold text-gray-800 text-lg">{section.title}</h3></div>
                    <div className="p-6 space-y-8">
                      {(section.categories || []).map((category) => (
                        <div key={category.id} className="space-y-4">
                          <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm border-b border-gray-100 pb-2">{category.title}</h4>
                          <div className="space-y-4">
                            {(category.indicators || []).map((indicator) => (
                              <div key={indicator.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                <p className="text-gray-700 font-medium md:w-2/3 leading-snug">{indicator.text}</p>
                                <div className="flex gap-2 shrink-0 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                  {['A', 'B', 'C', 'D'].map((val) => (
                                    <label key={val} className={`flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold transition-all ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}>
                                      <input type="radio" name={indicator.id} value={val} className="hidden" onChange={() => handleScoreChange(indicator.id, val as 'A'|'B'|'C'|'D')} required />
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
                <div className="pt-6 border-t border-gray-200 flex justify-end">
                  <button type="submit" disabled={isSubmitting} className="bg-[#053b50] hover:bg-[#032635] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Submitting...' : 'Submit Self-Reflection'}
                  </button>
                </div>
              </form>
            </div>
          )
        )}
      </div>
    </div>
  );
}