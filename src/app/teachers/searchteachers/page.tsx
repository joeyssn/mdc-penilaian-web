

'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  role: string;
  gender?: string | null;
};

// Types to handle the complex Rubric nesting
type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { id: string; title: string; sections: Section[] };

export default function TeacherEvaluationPage() {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Evaluation States
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Fetch the actual logged-in user from the secure cookie
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      setLoggedInUser(meData);
    }

    // 2. Fetch teachers for the search list
    const tRes = await fetch('/api/teachers');
    const tData = await tRes.json();
    if (!tData.error) {
      setTeachers(tData);
    }

    // 3. Fetch the active rubric format
    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    if (!rData.error && rData.length > 0) {
      setRubrics(rData);
    }
  };

  // Helper for Mr / Ma'am
  const getTitle = (gender?: string | null) => {
    if (gender === 'Laki-Laki') return 'Mr. ';
    if (gender === 'Perempuan') return "Ma'am ";
    return '';
  };

  const handleScoreChange = (indicatorId: string, value: number) => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !loggedInUser) return;

    // Convert the scores object into the array format the API expects
    const scoreArray = Object.entries(scores).map(([indicatorId, value]) => ({
      indicatorId,
      value
    }));

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
          graderId: loggedInUser.id, // Uses the REAL logged-in user's ID
          targetId: selectedTarget.id,
          scores: scoreArray
        }),
      });

      if (res.ok) {
        alert("Evaluation submitted successfully!");
        setSelectedTarget(null);
        setScores({}); // Reset form
      } else {
        alert("Failed to submit evaluation. Check database connection.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter out the logged-in user so they cannot grade themselves!
  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    t.id !== loggedInUser?.id
  );

  const activeRubric = rubrics[0];

  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans">
      
      {/* Teacher Navigation Bar */}
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-6">
          {loggedInUser && (
            <div className="hidden md:block text-sm font-bold text-gray-700">
              Welcome, <span className="text-[#008c99]">{getTitle(loggedInUser.gender)}{loggedInUser.name}</span>
            </div>
          )}

          <Link href="/login" className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2 rounded-lg text-sm font-bold transition-colors border border-red-200">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#053b50]">Peer Evaluation Portal</h1>
          <p className="text-gray-500 mt-1">Select a teacher below to begin scoring.</p>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mb-8">
          <div className="flex items-center px-8 py-5 border-b border-gray-100 bg-gray-50">
            <svg className="w-6 h-6 text-gray-400 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text"
              placeholder="Search for a Teacher to evaluate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full outline-none text-gray-800 text-xl font-bold placeholder:text-gray-400 bg-transparent"
              autoComplete="off" 
            />
          </div>

          {/* TEACHER LIST */}
          {searchQuery && (
            <div className="max-h-[300px] overflow-y-auto">
              {filteredTeachers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold">No teachers found.</div>
              ) : (
                filteredTeachers.map(teacher => (
                  <div 
                    key={teacher.id}
                    onClick={() => setSelectedTarget(teacher)}
                    className="p-4 px-8 flex items-center justify-between hover:bg-[#008c99]/5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500 text-lg">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#008c99] transition-colors">
                          {getTitle(teacher.gender)}{teacher.name}
                        </h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{teacher.role}</p>
                      </div>
                    </div>
                    <button className="bg-white border-2 border-[#f39c12] text-[#f39c12] group-hover:bg-[#f39c12] group-hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                      Evaluate
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ============================== */}
        {/* EVALUATION FORM (RUBRIC) */}
        {/* ============================== */}
        {selectedTarget && activeRubric && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#008c99] px-8 py-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                <p className="text-[#008c99] text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 font-medium">Rubric: {activeRubric.title}</p>
              </div>
              <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-lg transition-colors text-sm">
                Cancel
              </button>
            </div>

            <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
              
              {/* Render Sections -> Categories -> Indicators */}
              {(activeRubric.sections || []).map((section) => (
                <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 text-lg">{section.title}</h3>
                  </div>
                  
                  <div className="p-6 space-y-8">
                    {(section.categories || []).map((category) => (
                      <div key={category.id} className="space-y-4">
                        <h4 className="font-bold text-[#f39c12] uppercase tracking-wide text-sm border-b border-gray-100 pb-2">
                          {category.title}
                        </h4>
                        
                        <div className="space-y-4">
                          {(category.indicators || []).map((indicator) => (
                            <div key={indicator.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                              <p className="text-gray-700 font-medium md:w-2/3 leading-snug">
                                {indicator.text}
                              </p>
                              
                              {/* A, B, C, D Scoring Inputs */}
                              <div className="flex gap-2 shrink-0 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                {[1, 2, 3, 4].map((val) => (
                                  <label 
                                    key={val} 
                                    className={`
                                      flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold transition-all
                                      ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}
                                    `}
                                  >
                                    <input 
                                      type="radio" 
                                      name={indicator.id} 
                                      value={val}
                                      className="hidden"
                                      onChange={() => handleScoreChange(indicator.id, val)}
                                      required
                                    />
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
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-[#f39c12] hover:bg-[#e67e22] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving Scores...' : 'Submit Evaluation'}
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
}