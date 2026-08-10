"use client";

import { useState } from "react";
import { RubricSection } from "./types";
import CategoryCard from "./CategoryCard";
import AddCategoryModal from "./AddCategoryModal";

interface Props {
  section: RubricSection;
  onRefresh: () => void;
}

export default function RubricSectionCard({ section, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [showAddCategory, setShowAddCategory] = useState(false);

  async function saveSection() {
    if (!title.trim()) {
      alert("Section title cannot be empty.");
      return;
    }

    try {
      await fetch("/api/rubric/section", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: section.id, title }),
      });
      setEditing(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update section.");
    }
  }

  async function deleteSection() {
    if (!confirm("Delete this section and all of its categories?")) return;

    try {
      await fetch("/api/rubric/section", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: section.id }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete section.");
    }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
        
        {/* HEADER */}
        <div className="bg-gray-50/80 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-[#008397] transition text-sm flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm shrink-0"
            >
              {expanded ? "▼" : "▶"}
            </button>

            {editing ? (
              <input
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-[#053b50] focus:ring-2 focus:ring-[#008397]/50 focus:outline-none w-full max-w-md"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <h2 className="text-lg font-bold text-[#053b50]">
                {section.title}
              </h2>
            )}
          </div>

          <div className="flex gap-2 shrink-0 ml-4">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setTitle(section.title); }} className="text-xs font-semibold text-gray-600 hover:text-gray-700 px-3 py-1.5 border border-gray-200 bg-white rounded-lg shadow-sm">
                  Cancel
                </button>
                <button onClick={saveSection} className="text-xs font-semibold text-green-600 hover:text-green-700 px-3 py-1.5 border border-green-200 bg-green-50 rounded-lg shadow-sm">
                  Save
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowAddCategory(true)} className="text-xs font-semibold text-[#008397] hover:text-[#006e80] px-3 py-1.5 border border-[#008397]/20 bg-[#008397]/5 rounded-lg shadow-sm">
                  + Category
                </button>
                <button onClick={() => setEditing(true)} className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 px-3 py-1.5 border border-yellow-200 bg-yellow-50 rounded-lg shadow-sm">
                  Edit
                </button>
                <button onClick={deleteSection} className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 bg-red-50 rounded-lg shadow-sm">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* BODY */}
        {expanded && (
          <div className="p-6 space-y-6">
            {(!section.categories || section.categories.length === 0) && (
              <div className="text-gray-400 text-sm italic">No categories in this section yet.</div>
            )}
            
            {(section.categories || [])
              .sort((a, b) => {
                // FIXED: Same as above. Return 0 to prevent ID-based shuffling.
                if (typeof a.order === 'number' && typeof b.order === 'number' && (a.order > 0 || b.order > 0)) {
                  return a.order - b.order;
                }
                return 0;
              })
              .map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onRefresh={onRefresh}
                />
              ))}
          </div>
        )}
      </div>

      <AddCategoryModal
        open={showAddCategory}
        sectionId={section.id}
        onClose={() => setShowAddCategory(false)}
        onSuccess={onRefresh}
      />
    </>
  );
}