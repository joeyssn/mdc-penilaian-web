'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Indicator = { id: string; text: string; };
type Category = { id: string; title: string; indicators: Indicator[]; };

export default function EditObservasiTemplatePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    const res = await fetch('/api/observasi/template');
    if (res.ok) {
      const data = await res.json();
      setCategories(data);
    }
    setIsLoading(false);
  };

  const handleIndicatorChange = (catIndex: number, indIndex: number, newText: string) => {
    const updated = [...categories];
    updated[catIndex].indicators[indIndex].text = newText;
    setCategories(updated);
  };

  const addIndicator = (catIndex: number) => {
    const updated = [...categories];
    const catId = updated[catIndex].id; // 'A', 'B', or 'C'
    const newId = `${catId}${Date.now()}`; // Generate a unique ID
    updated[catIndex].indicators.push({ id: newId, text: '' });
    setCategories(updated);
  };

  const removeIndicator = (catIndex: number, indIndex: number) => {
    if (!confirm("Are you sure you want to remove this question?")) return;
    const updated = [...categories];
    updated[catIndex].indicators.splice(indIndex, 1);
    setCategories(updated);
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    const res = await fetch('/api/observasi/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories)
    });

    if (res.ok) {
      alert("Template saved successfully! All new observations will use these updated questions.");
    } else {
      alert("Failed to save template.");
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Loading Template...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
            <Link href="/admin" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Overview
            </Link>
            <Link href="/admin/teachers" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Teachers/Staff
            </Link>
            <Link href="/admin/rubric" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Rubrics
            </Link>
            <Link href="/admin/observasi-template" className="text-[#053b50] border-b-2 border-[#008c99] pb-1 transition-all">
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

      <div className="max-w-4xl mx-auto px-6 pt-12 space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Edit Observasi Template</h1>
            <p className="text-gray-600 mt-1">Modify the questions used in the Instrumen Observasi form.</p>
          </div>
          <button onClick={saveTemplate} disabled={isSaving} className="bg-[#008c99] hover:bg-[#007b87] text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Template Changes'}
          </button>
        </div>

        {categories.map((category, catIndex) => (
          <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#053b50] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">{category.title}</h3>
              <button onClick={() => addIndicator(catIndex)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">
                + Add Question
              </button>
            </div>
            <div className="p-6 space-y-4">
              {category.indicators.map((ind, indIndex) => (
                <div key={ind.id} className="flex items-start gap-4">
                  <div className="bg-gray-100 text-gray-500 font-bold px-3 py-2 rounded-lg shrink-0 mt-1">{indIndex + 1}</div>
                  <textarea 
                    value={ind.text} 
                    onChange={(e) => handleIndicatorChange(catIndex, indIndex, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#008c99]/50 min-h-[60px]"
                    placeholder="Enter question text here..."
                  />
                  <button onClick={() => removeIndicator(catIndex, indIndex)} className="text-red-500 hover:bg-red-50 p-3 rounded-lg shrink-0 mt-1 transition-colors" title="Delete Question">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              {category.indicators.length === 0 && (
                <p className="text-gray-400 text-center italic py-4">No questions in this section.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}