'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  role: string;
  gender?: string | null;
  department?: string | null; 
  grade?: number | null; 
  level?: string | null; 
  className?: string | null;
};

type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };

// Added 'evaluators' to the Rubric type so TypeScript knows to look for it!
type Rubric = { id: string; title: string; evaluators?: string | null; sections: Section[] };

export default function StudentDashboard() {
    const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
    const [teachers, setTeachers] = useState<User[]>([]);
    const [rubrics, setRubrics] = useState<Rubric[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Evaluation States
    const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
    const [scores, setScores] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
            const meData = await meRes.json();
            setLoggedInUser(meData);
        }

        const tRes = await fetch('/api/teachers');
        const tData = await tRes.json();
        if (!tData.error) setTeachers(tData);

        const rRes = await fetch('/api/rubric');
        const rData = await rRes.json();
        if (!rData.error && rData.length > 0) setRubrics(rData);
    };

    const getTitle = (gender?: string | null) => {
        if (gender === 'Laki-Laki') return 'Mr. ';
        if (gender === 'Perempuan') return "Ma'am ";
        return '';
    };

    const handleScoreChange = (indicatorId: string, value: 'A' | 'B' | 'C' | 'D') => {
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
                alert("Evaluation submitted successfully! Thank you for your feedback.");
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

  // ==========================================
  // STRICT TEACHER, GRADE & DEPARTMENT FILTERING
  // ==========================================
  const filteredTeachers = teachers.filter(teacher => {
    // 1. STRICT ROLE CHECK: Only allow Teachers.
    if (teacher.role !== 'TEACHER') return false;
    
    // 2. Text Search Filter
    if (!teacher.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    const studentGrade = loggedInUser?.grade;
    const studentMajor = loggedInUser?.department?.toUpperCase(); 
    const teacherDept = teacher.department?.toUpperCase(); 

    // 3. SMP (Grades 7-9) and SMA Grade 10 have access to ALL teachers
    if (studentGrade && studentGrade <= 10) return true;

    // 4. SMA Grades 11 & 12 Logic:
    // Everyone can evaluate UMUM teachers
    if (teacherDept === 'UMUM') return true;
    
    // IPA students evaluate IPA teachers
    if (studentMajor === 'IPA' && teacherDept === 'IPA') return true;
    
    // IPS students evaluate IPS teachers
    if (studentMajor === 'IPS' && teacherDept === 'IPS') return true;

    // If it doesn't match any of the above, hide the teacher
    return false;
  });
// THE FIX: Safely convert evaluators to a string first, in case the API returns an Array!
  const activeRubric = rubrics.find((rubric) => {
    if (!rubric.evaluators) return false;
    
    // Wrapping it in String() prevents the crash regardless of whether it's an array or text
    const validEvaluators = String(rubric.evaluators).toLowerCase();
    return validEvaluators.includes('student') || validEvaluators.includes('siswa');
  }) || rubrics[0];
  
    return (
        <div className="min-h-screen bg-[#f7f8f9] font-sans">

            {/* Navigation */}
            <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
                <div className="flex items-center">
                    <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
                </div>

                <div className="flex items-center gap-10">
                    <div className="hidden md:flex gap-10 text-[15px] font-medium text-gray-800">
                        <Link href="/student" className="text-black border-b-2 border-black pb-1">
                            Dashboard
                        </Link>
                    </div>

                    <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-medium transition-colors">
                        Logout
                    </Link>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-6 pt-12 pb-20 space-y-12">

                {/* Welcome Banner */}
                <div>
                    {loggedInUser && (
                        <h1 className="text-4xl font-extrabold text-[#053b50] mb-8">
                            Hi, Welcome {loggedInUser.name}
                        </h1>
                    )}

                    <div className="bg-[#008c99] rounded-2xl px-8 py-8 text-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-wide">Student Evaluation Portal</h2>
                            <p className="text-sm font-medium opacity-90 mt-2 max-w-lg">
                                Your feedback helps us improve our teaching quality. Please search for your teachers below to submit your evaluation. Your responses are recorded securely.
                            </p>
                        </div>
                        {loggedInUser?.className && (
                            <div className="bg-white/20 px-6 py-3 rounded-xl backdrop-blur-sm shrink-0 border border-white/20 text-center">
                                <div className="text-xs uppercase tracking-widest font-bold opacity-80">Your Class</div>
                                <div className="text-2xl font-extrabold">{loggedInUser.className}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* SEARCH BAR */}
                <div className="pt-4">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mt-6">
                        <div className="flex items-center px-8 py-5 border-b border-gray-100 bg-gray-50">
                            <svg className="w-6 h-6 text-gray-400 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search for your Teachers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                suppressHydrationWarning 
                                className="w-full outline-none text-gray-800 text-xl font-bold placeholder:text-gray-400 bg-transparent"
                                autoComplete="off"
                            />
                        </div>

                        {/* TEACHER LIST */}
                        {searchQuery && (
                            <div className="max-h-[300px] overflow-y-auto">
                                {filteredTeachers.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500 font-bold">No assigned teachers found for your class.</div>
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
                                                    <div className="flex gap-2 items-center mt-1">
                                                        <span className="text-xs text-gray-500 uppercase tracking-wide">{teacher.role}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${teacher.department === 'UMUM' ? 'bg-gray-100 text-gray-600' :
                                                            teacher.department === 'IPA' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                                                            }`}>
                                                            {teacher.department || 'UMUM'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="bg-white border-2 border-[#e99a24] text-[#e99a24] group-hover:bg-[#e99a24] group-hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                                                Evaluate
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* EVALUATION FORM (RUBRIC) */}
                    {selectedTarget && activeRubric && (
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 mt-8">
                            <div className="bg-[#053b50] px-8 py-6 text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-extrabold tracking-tight">Evaluating: {getTitle(selectedTarget.gender)}{selectedTarget.name}</h2>
                                    <p className="text-white/70 text-sm mt-1 font-medium">Please grade the teacher honestly based on your experience.</p>
                                </div>
                                <button onClick={() => { setSelectedTarget(null); setScores({}); }} className="text-white/70 hover:text-white font-bold bg-black/20 hover:bg-black/40 px-4 py-2 rounded-lg transition-colors text-sm">
                                    Cancel
                                </button>
                            </div>

                            <form onSubmit={submitEvaluation} className="p-8 space-y-8 bg-gray-50">
                                {(activeRubric.sections || []).map((section) => (
                                    <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                                            <h3 className="font-bold text-gray-800 text-lg">{section.title}</h3>
                                        </div>

                                        <div className="p-6 space-y-8">
                                            {(section.categories || []).map((category) => (
                                                <div key={category.id} className="space-y-4">
                                                    <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm border-b border-gray-100 pb-2">
                                                        {category.title}
                                                    </h4>

                                                    <div className="space-y-4">
                                                        {(category.indicators || []).map((indicator) => (
                                                            <div key={indicator.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                                                <p className="text-gray-700 font-medium md:w-2/3 leading-snug">
                                                                    {indicator.text}
                                                                </p>

                                                                <div className="flex gap-2 shrink-0 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                                                    {['A', 'B', 'C', 'D'].map((val) => (
                                                                        <label
                                                                            key={val}
                                                                            className={`flex items-center justify-center w-10 h-10 rounded-md cursor-pointer font-bold transition-all ${scores[indicator.id] === val ? 'bg-[#008c99] text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}`}
                                                                        >
                                                                            <input
                                                                                type="radio"
                                                                                name={indicator.id}
                                                                                value={val}
                                                                                className="hidden"
                                                                                onChange={() => handleScoreChange(indicator.id, val as 'A' | 'B' | 'C' | 'D')}
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
                                        className="bg-[#e99a24] hover:bg-[#d68a1f] text-white font-extrabold text-lg px-10 py-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Saving Scores...' : 'Submit Evaluation'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}