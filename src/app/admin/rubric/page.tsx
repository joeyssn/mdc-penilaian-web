"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RubricSectionCard from "./RubricSectionCard";
import AddSectionModal from "./AddSectionModal";
import AddRubricModal from "./AddRubricModal";
import { Rubric } from "./types";

const AVAILABLE_ROLES = ["Teacher", "Staff", "Director/Principal", "Student"];

export default function RubricPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddRubric, setShowAddRubric] = useState(false);
  
  const [selectedRubricId, setSelectedRubricId] = useState<string>("");

  // Top-Level Rubric Edit State
  const [editingRubric, setEditingRubric] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Permissions State
  const [editingSettings, setEditingSettings] = useState(false);
  const [evaluators, setEvaluators] = useState<string[]>([]);
  const [evaluatees, setEvaluatees] = useState<string[]>([]);

  async function fetchRubrics(preserveSelection = false) {
    try {
      setLoading(!preserveSelection);
      const res = await fetch("/api/rubric", { cache: "no-store" });
      const data = await res.json();

      if (Array.isArray(data)) {
        setRubrics(data);
        if (data.length > 0) {
          // If we are preserving selection, keep the current ID. Otherwise, pick the first one.
          const activeId = preserveSelection && selectedRubricId ? selectedRubricId : data[0].id;
          setSelectedRubricId(activeId);
          
          const activeRubric = data.find((r: Rubric) => r.id === activeId) || data[0];
          setEvaluators(activeRubric.evaluators || []);
          setEvaluatees(activeRubric.evaluatees || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRubrics();
  }, []);

  // Sync state when you select a different rubric from the dropdown
  useEffect(() => {
    if (selectedRubricId) {
      const active = rubrics.find((r) => r.id === selectedRubricId);
      if (active) {
        setEvaluators(active.evaluators || []);
        setEvaluatees(active.evaluatees || []);
        setEditingSettings(false);
        setEditingRubric(false);
      }
    }
  }, [selectedRubricId, rubrics]);

  const toggleRole = (role: string, type: "evaluator" | "evaluatee") => {
    if (type === "evaluator") {
      setEvaluators((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
    } else {
      setEvaluatees((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
    }
  };

  const handleSavePermissions = async () => {
  // Check for both Teacher and Staff
  if ((evaluators.includes("Teacher") || evaluators.includes("Staff") || evaluators.includes("student")) && evaluatees.includes("Director/Principal")) {
    alert("Policy Error: Teachers and Staff are not permitted to score the Director/Principal.");
    return;
  }
  
  try {
    await fetch("/api/rubric", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedRubricId, evaluators, evaluatees }),
    });
    setEditingSettings(false);
    fetchRubrics(true);
  } catch (err) {
    alert("Failed to update rubric settings.");
  }
};

  const handleSaveRubricInfo = async () => {
    try {
      await fetch("/api/rubric", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRubricId, title: editTitle, description: editDesc }),
      });
      setEditingRubric(false);
      fetchRubrics(true);
    } catch (err) {
      alert("Failed to update rubric info.");
    }
  };

  const handleDeleteRubric = async () => {
    if (!confirm("Are you sure you want to permanently delete this ENTIRE rubric?")) return;
    try {
      await fetch("/api/rubric", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRubricId }),
      });
      setSelectedRubricId("");
      fetchRubrics(); // Reset entirely
    } catch (err) {
      alert("Failed to delete rubric.");
    }
  };

  const rubric = rubrics.find((r) => r.id === selectedRubricId);

  return (
    <div className="min-h-screen bg-[#fafbfc] font-sans text-slate-800">
      
      {/* Navigation Bar */}
     <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-10">
          {/* Admin Navigation Links */}
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
            <Link href="/admin" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Overview
            </Link>
            <Link href="/admin/teachers" className="hover:text-[#008c99] border-b-2 border-transparent hover:border-[#008c99] pb-1 transition-all">
              Teachers/Staff
            </Link>
            <Link href="/admin/rubric" className="text-[#053b50] border-b-2 border-[#008c99] pb-1 transition-all">
              Rubrics
            </Link>
          </div>
          
          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-10 px-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-[#053b50] tracking-tight">Manage Rubrics</h1>
            <p className="text-gray-500 mt-2 text-sm">Configure evaluation criteria and access permissions.</p>
          </div>
          <button onClick={() => setShowAddRubric(true)} className="bg-[#053b50] hover:bg-[#032838] text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition shadow-sm">
            + Create New Rubric
          </button>
        </div>

        {loading ? (
           <div className="py-20 text-center font-bold text-gray-400">Loading data...</div>
        ) : !rubric ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="text-gray-500 mb-4">No rubrics exist yet.</p>
            <button onClick={() => setShowAddRubric(true)} className="bg-[#008397] text-white px-6 py-2.5 rounded-lg font-semibold text-sm">Create your first Rubric</button>
          </div>
        ) : (
          <>
            {/* RUBRIC SELECTOR */}
            <div className="mb-6 flex items-center gap-4">
              <label className="font-bold text-sm text-gray-600">Active Rubric:</label>
              <select 
                value={selectedRubricId} 
                onChange={(e) => setSelectedRubricId(e.target.value)}
                className="bg-white border border-gray-300 text-[#053b50] font-semibold rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#008397]/50 focus:outline-none shadow-sm"
              >
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>

            {/* RUBRIC CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
              
              {/* Rubric Title & Description Header */}
              <div className="border-b border-gray-100 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 gap-4">
                
                {editingRubric ? (
                   <div className="flex-1 w-full space-y-3 pr-8">
                     <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-lg text-[#053b50]" placeholder="Rubric Title" />
                     <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 resize-none" placeholder="Description" rows={2} />
                   </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-bold text-[#053b50]">{rubric.title}</h2>
                    {rubric.description && <p className="text-gray-500 mt-2 text-sm">{rubric.description}</p>}
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                   {editingRubric ? (
                      <>
                        <button onClick={() => setEditingRubric(false)} className="text-xs font-semibold bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded-lg transition">Cancel</button>
                        <button onClick={handleSaveRubricInfo} className="text-xs font-semibold bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg transition">Save Info</button>
                      </>
                   ) : (
                      <>
                        <button onClick={() => { setEditTitle(rubric.title); setEditDesc(rubric.description || ""); setEditingRubric(true); }} className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg shadow-sm transition">Edit Info</button>
                        <button onClick={() => setEditingSettings(!editingSettings)} className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg shadow-sm transition">{editingSettings ? "Cancel Rules" : "Access Rules"}</button>
                        <button onClick={handleDeleteRubric} className="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg shadow-sm transition">Delete</button>
                      </>
                   )}
                </div>
              </div>

              {/* Permissions Panel */}
              {editingSettings ? (
                <div className="px-8 py-6 bg-white border-b border-gray-100">
                  <h3 className="font-bold text-[#053b50] mb-4 text-sm uppercase tracking-wide">Assignment & Access Rules</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Who evaluates? (Evaluators)</label>
                      <div className="flex gap-4 flex-wrap">
                        {AVAILABLE_ROLES.map((role) => (
                          <label key={`evaluator-${role}`} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={evaluators.includes(role)} onChange={() => toggleRole(role, "evaluator")} className="w-4 h-4 rounded border-gray-300 text-[#008397] focus:ring-[#008397]" /> {role}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Who receives the score? (Target)</label>
                      <div className="flex gap-4 flex-wrap">
                        {AVAILABLE_ROLES.map((role) => (
                          <label key={`evaluatee-${role}`} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={evaluatees.includes(role)} onChange={() => toggleRole(role, "evaluatee")} className="w-4 h-4 rounded border-gray-300 text-[#008397] focus:ring-[#008397]" /> {role}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button onClick={handleSavePermissions} className="bg-[#008397] hover:bg-[#006e80] text-white px-5 py-2 rounded-lg font-semibold text-sm transition">Save Access Rules</button>
                  </div>
                </div>
              ) : (
                 <div className="px-8 py-4 bg-white border-b border-gray-100 flex gap-10">
                    <div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Evaluators</span><span className="text-sm font-medium text-slate-700">{evaluators.length > 0 ? evaluators.join(", ") : "Not assigned"}</span></div>
                    <div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Target (Evaluatees)</span><span className="text-sm font-medium text-slate-700">{evaluatees.length > 0 ? evaluatees.join(", ") : "Not assigned"}</span></div>
                 </div>
              )}

              {/* Sections List */}
              <div className="p-8 space-y-6 bg-[#fafbfc]">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-600 uppercase tracking-wide text-sm">Rubric Sections</h3>
                  <button onClick={() => setShowAddSection(true)} className="text-[#008397] hover:text-[#006e80] font-bold text-sm bg-white border border-gray-200 px-4 py-1.5 rounded-lg shadow-sm">+ Add Section</button>
                </div>
                
                {rubric.sections?.length === 0 && <div className="text-gray-400 italic text-sm">No sections added yet.</div>}
                
                {(rubric.sections || [])
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <RubricSectionCard key={section.id} section={section} onRefresh={() => fetchRubrics(true)} />
                  ))}
              </div>

            </div>
          </>
        )}

      </main>

      <AddRubricModal open={showAddRubric} onClose={() => setShowAddRubric(false)} onSuccess={() => fetchRubrics(true)} />
      
      {rubric && (
        <AddSectionModal rubricId={rubric.id} open={showAddSection} onClose={() => setShowAddSection(false)} onSuccess={() => fetchRubrics(true)} />
      )}
    </div>
  );
}