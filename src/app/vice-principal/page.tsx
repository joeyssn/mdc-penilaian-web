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

type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { 
  id: string; 
  title: string; 
  evaluators: string[]; 
  evaluatees: string[]; 
  sections: Section[] 
};

type ScoreStats = { average: number; totalEvaluations: number; letterGrade: string; };
type MyScores = { peer: ScoreStats; student: ScoreStats; };

export default function VicePrincipalDashboard() {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [myScores, setMyScores] = useState<MyScores | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [completedEvals, setCompletedEvals] = useState<Set<string>>(new Set());
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [scores, setScores] = useState<Record<string, 'A'|'B'|'C'|'D'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      setLoggedInUser(meData);
      
      const compRes = await fetch(`/api/evaluate/completed?graderId=${meData.id}`);
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompletedEvals(new Set(compData)); 
      }
    }

    const scoreRes = await fetch('/api/me/scores');
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      if (!scoreData.error) setMyScores(scoreData);
    }

    // 🚀 UPDATE THIS LINE RIGHT HERE:
    const tRes = await fetch('/api/vice-principal/targets');
    const tData = await tRes.json();
    if (!tData.error) setTeachers(tData);

    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    
    if (!rData.error && rData.length > 0) {
      setRubrics(rData);
    }
  };

  const getTitle = (gender?: string | null) => {
    if (gender === 'Laki-Laki') return 'Mr. ';
    if (gender === 'Perempuan') return "Ma'am ";
    return '';
  };

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return '';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF') return 'Staff';
    if (upper === 'PRINCIPAL' || upper === 'DIRECTOR') return 'Director/Principal';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return dbRole;
  };

  const isSelfReflectionRule = (r: Rubric) => {
    const requiredRoles = ["Teacher", "Staff", "Vice-Principal", "Director/Principal"];
    const excludedRoles = ["Admin", "Student"];
    
    const hasRequired = requiredRoles.every(role => r.evaluators?.includes(role) && r.evaluatees?.includes(role));
    const hasExcluded = excludedRoles.some(role => r.evaluators?.includes(role) || r.evaluatees?.includes(role));
    
    return hasRequired && !hasExcluded;
  };

  const handleScoreChange = (indicatorId: string, value: 'A'|'B'|'C'|'D') => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !loggedInUser) return;

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
          targetId: selectedTarget.id,
          scores: scoreArray
        }),
      });

      if (res.ok) {
        alert("Evaluation submitted successfully!");
        setCompletedEvals(prev => new Set(prev).add(selectedTarget.id));
        setSelectedTarget(null);
        setScores({}); 
      } else {
        alert("Failed to submit evaluation.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 VICE-PRINCIPAL FILTERING RULES
  const filteredTeachers = teachers.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch || !loggedInUser || target.id === loggedInUser.id) return false;

    const targetRole = (target.role || '').toUpperCase();

    // They CANNOT score Students, Directors, or Admins.
    if (targetRole === 'STUDENT' || targetRole === 'DIRECTOR' || targetRole === 'ADMIN') {
      return false;
    }
    
    // They CAN score Principals, other Vice-Principals, Teachers, and Staff.
    return true;
  });

  let activeRubric: Rubric | null = null;
  
  if (loggedInUser && selectedTarget) {
    const myRole = getNormalizedRole(loggedInUser.role);
    const targetRole = getNormalizedRole(selectedTarget.role);

    activeRubric = rubrics.find(r => 
      r.evaluators?.includes(myRole) && 
      r.evaluatees?.includes(targetRole) &&
      !isSelfReflectionRule(r)
    ) || null;
  }

  let overallAvg = 0;
  if (myScores) {
    const totalEvals = myScores.peer.totalEvaluations + myScores.student.totalEvaluations;
    if (totalEvals > 0) {
      overallAvg = ((myScores.peer.average * myScores.peer.totalEvaluations) + (myScores.student.average * myScores.student.totalEvaluations)) / totalEvals;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
           <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-10 text-[15px] font-medium text-gray-800">
            <Link href="/vice-principal" className="text-black border-b-2 border-black pb-1">Home</Link>
          </div>
          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-medium transition-colors">Logout</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-12 pb-20 space-y-12">
        <div>
          {loggedInUser && (
            <h1 className="text-4xl font-extrabold text-[#053b50] mb-8">
              Hi, Welcome {getTitle(loggedInUser.gender)}{loggedInUser.name}
            </h1>
          )}

          {myScores && (
            <>
              <div className="bg-[#e99a24] rounded-2xl px-8 py-6 text-white flex justify-between items-center mb-6 shadow-sm">
                <div>
                  <h2 className="text-2xl font-bold tracking-wide">Overall Evaluation Rating</h2>
                  <p className="text-sm font-medium opacity-90 mt-1">Based on student & peer feedback</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-extrabold tracking-tight">
                    {overallAvg > 0 ? overallAvg.toFixed(1) : '-.-'}
                  </div>
                  <div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                  <h3 className="text-2xl font-extrabold text-black">Peer Rating</h3>
                  <p className="text-gray-700 font-medium mb-8">Feedback from colleagues</p>
                  
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-4xl font-extrabold text-gray-500 tracking-tight">
                      {myScores.peer.average > 0 ? myScores.peer.average.toFixed(1) : '-.-'}
                      <span className="text-xl text-gray-500 font-bold">/4.0</span>
                    </div>
                    <div className="text-sm font-bold text-gray-500">({myScores.peer.totalEvaluations} participant)</div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3.5">
                    <div className="bg-gray-500 h-3.5 rounded-full transition-all duration-1000" style={{ width: `${(myScores.peer.average / 4) * 100}%` }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                  <h3 className="text-2xl font-extrabold text-black">Student Rating</h3>
                  <p className="text-gray-700 font-medium mb-8">Feedback from students</p>
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-4xl font-extrabold text-[#008c99] tracking-tight">
                      {myScores.student.average > 0 ? myScores.student.average.toFixed(1) : '-.-'}
                      <span className="text-xl text-[#008c99] font-bold">/4.0</span>
                    </div>
                    <div className="text-sm font-bold text-[#008c99]">({myScores.student.totalEvaluations} participant)</div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3.5">
                    <div className="bg-[#008c99] h-3.5 rounded-full transition-all duration-1000" style={{ width: `${(myScores.student.average / 4) * 100}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Exact same buttons as the Teacher page */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Link href="/self-reflection" className="w-full bg-[#053b50] hover:bg-[#032635] text-white font-bold py-4 rounded-xl shadow-md flex justify-center transition-all">
                  Complete Self-Reflection
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="pt-10 border-t border-gray-200">
          <div>
            <h2 className="text-3xl font-extrabold text-[#053b50]">Peer Evaluation Portal</h2>
            <p className="text-gray-500 mt-2 text-lg">Select a colleague below to begin scoring.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mt-6">
            <div className="flex items-center px-8 py-5 border-b border-gray-100 bg-gray-50">
              <svg className="w-6 h-6 text-gray-400 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
<input 
  type="text" 
  placeholder="Search for a Colleague..." 
  value={searchQuery} 
  onChange={(e) => setSearchQuery(e.target.value)} 
  className="w-full outline-none text-gray-800 text-xl font-bold placeholder:text-gray-400 bg-transparent" 
  autoComplete="off"
  suppressHydrationWarning /* 🚀 ADD THIS TO SILENCE THE WARNING */
/>            </div>

            {searchQuery && (
              <div className="max-h-[300px] overflow-y-auto">
                {filteredTeachers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-bold">No results found.</div>
                ) : (
                  filteredTeachers.map(teacher => {
                    const hasEvaluated = completedEvals.has(teacher.id);
                    return (
                      <div key={teacher.id} onClick={() => !hasEvaluated && setSelectedTarget(teacher)} className={`p-4 px-8 flex items-center justify-between transition-colors border-b border-gray-100 last:border-b-0 ${hasEvaluated ? 'opacity-60 bg-gray-50' : 'hover:bg-[#008c99]/5 cursor-pointer group'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${hasEvaluated ? 'bg-gray-200 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>{teacher.name.charAt(0)}</div>
                          <div>
                            <h3 className={`font-bold text-lg transition-colors ${hasEvaluated ? 'text-gray-500' : 'text-gray-900 group-hover:text-[#008c99]'}`}>{getTitle(teacher.gender)}{teacher.name}</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{teacher.role}</p>
                          </div>
                        </div>
                        {hasEvaluated ? (
                          <button disabled className="bg-gray-100 text-gray-400 border-2 border-gray-200 px-4 py-2 rounded-lg font-bold text-sm cursor-not-allowed">Completed</button>
                        ) : (
                          <button className="bg-white border-2 border-[#e99a24] text-[#e99a24] group-hover:bg-[#e99a24] group-hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">Evaluate</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {selectedTarget && (
            <div className="mt-8">
              {!activeRubric ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center shadow-sm">
                  <h3 className="text-lg font-bold text-red-700">No Rubric Assigned</h3>
                  <p className="text-red-600 mt-2">The admin has not assigned a rubric for you to evaluate this specific role yet. Please contact your administrator.</p>
                  <button onClick={() => setSelectedTarget(null)} className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-red-700">Go Back</button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-[#008c99] px-8 py-6 text-white flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                      <p className="text-[#008c99] text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 font-medium">Rubric: {activeRubric.title}</p>
                    </div>
                    <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-lg transition-colors text-sm">Cancel</button>
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
                      <button type="submit" disabled={isSubmitting} className="bg-[#e99a24] hover:bg-[#d68a1f] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving Scores...' : 'Submit Evaluation'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}