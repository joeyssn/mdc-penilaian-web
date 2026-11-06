'use client';

import SdTasks from '@/components/SdTasks';
import SelfReflectionLink from '@/components/SelfReflectionLink';
import SelfRatingCard from '@/components/SelfRatingCard';
import MyTeamScores from '@/components/MyTeamScores';
import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveProfile, cardWeights } from '@/lib/weights';
import ScoresLockedNotice from '@/components/ScoresLockedNotice';

// --- TYPES ---
type User = { id: string; name: string; role: string; gender?: string | null; department?: string; };
type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = { id: string; title: string; evaluators: string[]; evaluatees: string[]; sections: Section[] };
type ScoreStats = { average: number; totalEvaluations: number; letterGrade: string; };
type MyScores = { peer: ScoreStats; student: ScoreStats; locked?: boolean };

export default function KaryawanDashboard() {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [myScores, setMyScores] = useState<MyScores | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [completedEvals, setCompletedEvals] = useState<Set<string>>(new Set());
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 METRICS FOR THE TRUE FINAL SCORE
  const [myWeights, setMyWeights] = useState({ studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 });
  const [myAbsence, setMyAbsence] = useState<number | null>(null);
  const [myObsAvg, setMyObsAvg] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) return;
    const meData = await meRes.json();
    
    // Protect page - only Karyawan allowed
    if (meData.role !== 'KARYAWAN') return router.push('/login');
    setLoggedInUser(meData);
    
    // Fetch Completed Evals
    const compRes = await fetch(`/api/evaluate/completed?graderId=${meData.id}`);
    if (compRes.ok) setCompletedEvals(new Set(await compRes.json())); 

    // Fetch Base Scores (Peer scores from other people)
    const scoreRes = await fetch('/api/me/scores');
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      if (!scoreData.error) setMyScores(scoreData);
    }

    // Fetch Karyawan Weights from Admin Settings
    const wRes = await fetch('/api/settings/weights');
    const wData = await wRes.json();
    if (!wData.error && Array.isArray(wData)) {
      const kWeight = cardWeights(resolveProfile(wData, 'KARYAWAN', meData.level));
      if (kWeight) {
        setMyWeights({
          studentWeight: Number(kWeight.studentWeight) || 0,
          peerWeight: Number(kWeight.peerWeight) || 0,
          observationWeight: Number(kWeight.observationWeight) || 0,
          attendanceWeight: Number(kWeight.attendanceWeight) || 0
        });
      }
    }

    // Fetch Attendance Score from HRD
    const absRes = await fetch('/api/absences');
    const absData = await absRes.json();
    if (!absData.error) {
      const myAbs = absData.find((a: any) => a.userId === meData.id);
      if (myAbs) setMyAbsence(myAbs.attendanceScore);
    }

    // Fetch Approved Observation Score from Principal
    const obsRes = await fetch('/api/observasi');
    const obsData = await obsRes.json();
    if (!obsData.error) {
      const myApprovedObs = obsData.filter((o: any) => o.targetId === meData.id && o.isApproved);
      if (myApprovedObs.length > 0) {
        const avg = myApprovedObs.reduce((sum: number, o: any) => sum + o.finalScore, 0) / myApprovedObs.length;
        setMyObsAvg(avg);
      }
    }

    // Fetch Targets (For Peer Eval)
    const tRes = await fetch('/api/teachers');
    const tData = await tRes.json();
    if (!tData.error) setTeachers(tData);

    // Fetch Rubrics
    const rRes = await fetch('/api/rubric');
    const rData = await rRes.json();
    if (!rData.error && rData.length > 0) setRubrics(rData);
  };

  const getTitle = (gender?: string | null) => gender === 'Laki-Laki' ? 'Mr. ' : gender === 'Perempuan' ? "Ma'am " : '';

  const getNormalizedRole = (dbRole?: string) => {
    if (!dbRole) return 'Staff';
    const upper = dbRole.toUpperCase();
    if (upper === 'TEACHER') return 'Teacher';
    if (upper === 'STAFF' || upper === 'HRD') return 'Staff';
    if (upper === 'KARYAWAN') return 'Karyawan'; 
    if (upper === 'PRINCIPAL') return 'Principal';
    if (upper === 'DIRECTOR') return 'Director';
    if (upper === 'VICE_PRINCIPAL' || upper === 'VICE-PRINCIPAL' || upper === 'VICE_PRINCIPAL_KURIKULUM' || upper === 'VICE_PRINCIPAL_KESISWAAN') return 'Vice-Principal'; 
    if (upper === 'STUDENT') return 'Student';
    return 'Staff';
  };

  const isSelfReflectionRule = (r: Rubric) => {
    const requiredRoles = ["Teacher", "Staff", "Vice-Principal", "Director", "Principal", "Karyawan"];
    const excludedRoles = ["Admin", "Student"];
    const hasRequired = requiredRoles.every(role => r.evaluators?.includes(role) && r.evaluatees?.includes(role));
    const hasExcluded = excludedRoles.some(role => r.evaluators?.includes(role) || r.evaluatees?.includes(role));
    return hasRequired && !hasExcluded;
  };

  const handleScoreChange = (indicatorId: string, value: number) => {
    setScores(prev => ({ ...prev, [indicatorId]: value }));
  };

  const submitEvaluation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !loggedInUser) return;
    const scoreArray = Object.entries(scores).map(([indicatorId, value]) => ({ indicatorId, value }));
    if (scoreArray.length === 0) { alert("Please score at least one indicator before submitting."); return; }
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graderId: loggedInUser.id, targetId: selectedTarget.id, scores: scoreArray }),
      });
      if (res.ok) {
        alert("Evaluation submitted successfully!");
        setCompletedEvals(prev => new Set(prev).add(selectedTarget.id));
        setSelectedTarget(null);
        setScores({}); 
      } else { alert("Failed to submit evaluation."); }
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  // 🚀 THE KARYAWAN FIREWALL: Only show other Karyawans!
  const filteredTeachers = teachers.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch || !loggedInUser || target.id === loggedInUser.id) return false;
    const targetRole = (target.role || '').toUpperCase();
    if (targetRole !== 'KARYAWAN') return false;
    return true;
  });

  let activeRubric: Rubric | null = null;
  if (loggedInUser && selectedTarget) {
    const myRole = getNormalizedRole(loggedInUser.role);
    const targetRole = getNormalizedRole(selectedTarget.role);
    activeRubric = rubrics.find(r => 
      r.evaluators?.includes(myRole) && r.evaluatees?.includes(targetRole) && !isSelfReflectionRule(r)
    ) || null;
  }

  // CALCULATE THE TRUE FINAL DYNAMIC SCORE
  let activeWeightSum = 0;
  let accumulatedScore = 0;

  const pScore = myScores?.peer?.average || 0;
  const oScore = myObsAvg || 0;
  const aScore = myAbsence || 0;

  if (pScore > 0) { activeWeightSum += myWeights.peerWeight; accumulatedScore += (pScore * myWeights.peerWeight); }
  if (oScore > 0) { activeWeightSum += myWeights.observationWeight; accumulatedScore += (oScore * myWeights.observationWeight); }
  if (aScore > 0) { activeWeightSum += myWeights.attendanceWeight; accumulatedScore += (aScore * myWeights.attendanceWeight); }

  const trueOverallAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-.-';

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans">
      
      {/* NAVBAR */}
      <nav className="bg-white py-4 px-4 md:px-12 shadow-sm flex flex-col md:flex-row justify-between items-center z-50 relative border-b border-gray-200 gap-4 md:gap-0">
        <div className="flex items-center w-full md:w-auto justify-between">
           <Image src="/mdc-logo.png" alt="MDC" width={200} height={50} className="h-8 md:h-12 w-auto" priority />
           <Link href="/login" className="md:hidden text-red-500 font-bold text-sm">Logout</Link>
        </div>
        
        <div className="flex items-center gap-6 md:gap-10 w-full md:w-auto overflow-x-auto whitespace-nowrap pb-2 md:pb-0 scrollbar-hide">
          <div className="flex gap-6 md:gap-10 text-[14px] md:text-[15px] font-medium text-gray-800">
            <span className="text-[#053b50] font-bold border-b-2 border-[#008c99] pb-1">My Dashboard</span>
            <Link href="/assign" className="text-gray-500 hover:text-[#053b50] font-bold pb-1">Team Evaluations</Link>
          </div>
          <Link href="/login" className="hidden md:block text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">Logout</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-20 space-y-8 md:space-y-12">
        <MyTeamScores selfReflection={false} />
        
        {/* 🚀 PERSONAL SCORES SECTION */}
        <div>
          {loggedInUser && (
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50] mb-6 md:mb-8 text-center md:text-left">
              Hi, Welcome {getTitle(loggedInUser.gender)}{loggedInUser.name}
            </h1>
          )}

          {myScores?.locked && (
            <>
              <ScoresLockedNotice />
              <div className="mt-6">
                <SelfReflectionLink className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md flex justify-center transition-all text-sm md:text-base text-center">
                  Complete My Self-Reflection
                </SelfReflectionLink>
              </div>
            </>
          )}
          {myScores && !myScores.locked && (
            <>
              {/* MASTER FINAL SCORE CARD */}
              <div className="bg-[#053b50] rounded-2xl px-6 py-6 md:px-8 md:py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-md text-center md:text-left border border-gray-800">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-wide">Final Evaluation Rating</h2>
                  <p className="text-sm font-medium opacity-90 mt-1 text-gray-300">Your overall score based on the metrics below</p>
                </div>
                <div className="text-center md:text-right">
                  <div className="text-5xl md:text-5xl font-extrabold tracking-tight text-[#e99a24]">
                    {trueOverallAvg}
                  </div>
                  <div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div>
                </div>
              </div>

              {/* INDIVIDUAL BREAKDOWN CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 🚀 SCORES FROM OTHER PEOPLE (PEER RATING) */}
                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-gray-100">
                  <h3 className="text-lg md:text-xl font-extrabold text-black">Scores from Others</h3>
                  <p className="text-gray-500 font-medium mb-4 text-xs md:text-sm">Feedback from your colleagues</p>
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-3xl md:text-4xl font-extrabold text-[#f39c12] tracking-tight">
                      {pScore > 0 ? pScore.toFixed(1) : '-.-'}
                    </div>
                    <div className="text-xs md:text-sm font-bold text-[#f39c12]">({myScores.peer.totalEvaluations} reviews)</div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3">
                    <div className="bg-[#f39c12] h-3 rounded-full transition-all duration-1000" style={{ width: `${(pScore / 4) * 100}%` }}></div>
                  </div>
                </div>
                <SelfRatingCard />

                {/* OBSERVATION SCORE (FROM PRINCIPAL) */}
                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-gray-100">
                  <h3 className="text-lg md:text-xl font-extrabold text-black">Observation</h3>
                  <p className="text-gray-500 font-medium mb-4 text-xs md:text-sm">Score from Principal/Director</p>
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-3xl md:text-4xl font-extrabold text-green-600 tracking-tight">
                      {oScore > 0 ? oScore.toFixed(2) : '-.-'}
                    </div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(oScore / 4) * 100}%` }}></div>
                  </div>
                </div>

                {/* ATTENDANCE SCORE (FROM HRD) */}
                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-gray-100">
                  <h3 className="text-lg md:text-xl font-extrabold text-black">Attendance</h3>
                  <p className="text-gray-500 font-medium mb-4 text-xs md:text-sm">Score from HRD</p>
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-3xl md:text-4xl font-extrabold text-teal-600 tracking-tight">
                      {aScore > 0 ? aScore.toFixed(1) : '-.-'}
                    </div>
                  </div>
                  <div className="w-full bg-[#e6e6e6] rounded-full h-3">
                    <div className="bg-teal-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(aScore / 4) * 100}%` }}></div>
                  </div>
                </div>

              </div>

              <div className="mt-6">
                <SelfReflectionLink className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md flex justify-center transition-all text-sm md:text-base text-center">
                  Complete My Self-Reflection
                </SelfReflectionLink>
              </div>
            </>
          )}
        </div>

        {/* PEER EVALUATION PORTAL */}
        <div className="pt-8 md:pt-10 border-t border-gray-200">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#053b50]">Evaluate Colleagues</h2>
            <p className="text-gray-500 mt-2 text-sm md:text-lg">Your assigned peers, supervisors and koordinators appear here.</p>
          </div>

          <SdTasks embedded general />

          {selectedTarget && (
            <div className="mt-8">
              {!activeRubric ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 md:p-8 text-center shadow-sm">
                  <h3 className="text-base md:text-lg font-bold text-red-700">No Rubric Assigned</h3>
                  <p className="text-red-600 mt-2 text-sm md:text-base">The admin has not assigned a rubric for you to evaluate this specific role yet.</p>
                  <button onClick={() => setSelectedTarget(null)} className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-red-700 w-full sm:w-auto">Go Back</button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-[#008c99] px-6 py-5 md:px-8 md:py-6 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                      <p className="text-[#008c99] text-xs md:text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 font-medium">Rubric: {activeRubric.title}</p>
                    </div>
                    <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-lg transition-colors text-sm w-full sm:w-auto text-center">Cancel</button>
                  </div>

                  <form onSubmit={submitEvaluation} className="p-4 md:p-8 space-y-6 md:space-y-8 bg-gray-50">
                    {(activeRubric.sections || []).map((section) => (
                      <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gray-100 px-4 md:px-6 py-3 border-b border-gray-200">
                          <h3 className="font-bold text-gray-800 text-base md:text-lg">{section.title}</h3>
                        </div>
                        <div className="p-4 md:p-6 space-y-6 md:space-y-8">1
                          {(section.categories || []).map((category) => (
                            <div key={category.id} className="space-y-4">
                              <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-xs md:text-sm border-b border-gray-100 pb-2">{category.title}</h4>
                              <div className="space-y-4">
                                {(category.indicators || []).map((indicator) => (
                                  <div key={indicator.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                    <p className="text-gray-700 font-medium lg:w-2/3 leading-snug text-sm md:text-base">{indicator.text}</p>
                                    <div className="flex flex-wrap justify-center lg:justify-end gap-2 shrink-0 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
                                      {[1, 2, 3, 4].map((val) => (
                                        <label key={val} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-md cursor-pointer font-bold transition-all ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}>
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
                    <div className="pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end">
                      <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#e99a24] hover:bg-[#d68a1f] text-white font-extrabold text-base md:text-lg px-8 md:px-10 py-3 md:py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
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