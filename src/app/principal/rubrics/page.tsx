'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Indicator = { id: string; text: string; weight: number };
type Category = { id: string; title: string; indicators: Indicator[] };
type Section = { id: string; title: string; categories: Category[] };
type Rubric = {
  id: string;
  title: string;
  description?: string | null;
  isSelfReflection?: boolean;
  evaluators: string[];
  evaluatees: string[];
  sections: Section[];
};

const ROLES = ['Teacher', 'Staff', 'Vice-Principal', 'Director/Principal', 'Karyawan'];

// Principal view: can assign who evaluates whom, but the rubric content itself is read-only.
export default function PrincipalRubricAssignmentPage() {
  const router = useRouter();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [evaluators, setEvaluators] = useState<string[]>([]);
  const [evaluatees, setEvaluatees] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async (keepSelection = false) => {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) return router.push('/login');
    const me = await meRes.json();
    if (me.role !== 'PRINCIPAL' && me.role !== 'DIRECTOR' && me.role !== 'ADMIN') return router.push('/login');

    const res = await fetch('/api/rubric', { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data)) {
      setRubrics(data);
      const active = data.find((r: Rubric) => keepSelection && r.id === selectedId) || data[0];
      if (active) {
        setSelectedId(active.id);
        setEvaluators(active.evaluators || []);
        setEvaluatees(active.evaluatees || []);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRubric = (id: string) => {
    const r = rubrics.find(x => x.id === id);
    setSelectedId(id);
    setEvaluators(r?.evaluators || []);
    setEvaluatees(r?.evaluatees || []);
  };

  const toggle = (list: string[], setList: (v: string[]) => void, role: string) =>
    setList(list.includes(role) ? list.filter(r => r !== role) : [...list, role]);

  const save = async () => {
    setIsSaving(true);
    // Only evaluators / evaluatees are sent: the server rejects anything else from a principal.
    const res = await fetch('/api/rubric', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedId, evaluators, evaluatees }),
    });
    if (res.ok) {
      alert('Rubric assignment saved.');
      load(true);
    } else {
      alert((await res.json().catch(() => null))?.error || 'Failed to save assignment.');
    }
    setIsSaving(false);
  };

  const rubric = rubrics.find(r => r.id === selectedId);
  const changed = rubric
    ? [...evaluators].sort().join() !== [...(rubric.evaluators || [])].sort().join() ||
      [...evaluatees].sort().join() !== [...(rubric.evaluatees || [])].sort().join()
    : false;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading rubrics...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center border-b border-gray-200">
        <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        <Link href="/principal" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Back to Dashboard</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-10 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#053b50]">Assign Rubrics</h1>
          <p className="text-gray-500 mt-2 font-medium">Choose which roles evaluate which roles. Rubric content can only be edited by the admin.</p>
        </div>

        {rubrics.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500 font-bold">No rubrics have been created yet.</div>
        ) : (
          <>
            <select value={selectedId} onChange={(e) => selectRubric(e.target.value)} className="w-full md:w-auto border-2 border-[#008c99] text-[#053b50] font-bold rounded-xl px-4 py-3 bg-blue-50 outline-none">
              {rubrics.map(r => <option key={r.id} value={r.id}>{r.title}{r.isSelfReflection ? ' (Self-Reflection)' : ''}</option>)}
            </select>

            {rubric && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3">Who evaluates (Evaluators)</h3>
                      <div className="space-y-2">
                        {ROLES.map(role => (
                          <label key={role} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={evaluators.includes(role)} onChange={() => toggle(evaluators, setEvaluators, role)} className="w-4 h-4 accent-[#008c99]" />
                            <span className="font-medium text-gray-700">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3">Who is evaluated (Evaluatees)</h3>
                      <div className="space-y-2">
                        {ROLES.map(role => (
                          <label key={role} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={evaluatees.includes(role)} onChange={() => toggle(evaluatees, setEvaluatees, role)} className="w-4 h-4 accent-[#e99a24]" />
                            <span className="font-medium text-gray-700">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={save} disabled={isSaving || !changed} className="bg-[#008c99] hover:bg-[#007b87] text-white font-bold px-8 py-3 rounded-xl shadow-md transition-all disabled:opacity-50">
                      {isSaving ? 'Saving...' : 'Save Assignment'}
                    </button>
                  </div>
                </div>

                {/* READ-ONLY PREVIEW */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Rubric Content (read-only)</h3>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Edited by admin only</span>
                  </div>
                  <div className="p-6 space-y-6">
                    {rubric.description && <p className="text-gray-600">{rubric.description}</p>}
                    {rubric.sections.length === 0 && <p className="text-gray-400 font-medium">This rubric has no sections yet.</p>}
                    {rubric.sections.map(section => (
                      <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-5 py-3 font-bold text-gray-800 border-b border-gray-200">{section.title}</div>
                        <div className="p-5 space-y-4">
                          {section.categories.map(cat => (
                            <div key={cat.id}>
                              <h4 className="font-bold text-[#e99a24] uppercase tracking-wide text-sm mb-2">{cat.title}</h4>
                              <ul className="space-y-1.5">
                                {cat.indicators.map(ind => (
                                  <li key={ind.id} className="flex justify-between gap-4 text-gray-700 text-sm">
                                    <span>{ind.text}</span>
                                    <span className="text-gray-400 font-bold shrink-0">Weight {ind.weight}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
