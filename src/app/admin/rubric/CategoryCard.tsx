"use client";

import { useState } from "react";
import { RubricCategory } from "./types";
import IndicatorRow from "./IndicatorRow";
import AddIndicatorModal from "./AddIndicatorModal";

interface Props {
  category: RubricCategory;
  onRefresh: () => void;
}

export default function CategoryCard({ category, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(category.title);
  const [showAddIndicator, setShowAddIndicator] = useState(false);

  // ... (keep saveCategory and deleteCategory functions exactly as they are)
  async function saveCategory() {
    await fetch("/api/rubric/category", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id, title }),
    });
    setEditing(false);
    onRefresh();
  }

  async function deleteCategory() {
    if (!confirm("Delete this category and all indicators?")) return;
    await fetch("/api/rubric/category", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id }),
    });
    onRefresh();
  }

  return (
    <>
      <div className="bg-[#f8fafc] rounded-xl border border-gray-100 p-6">
        
        {/* HEADER */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 text-xs">
              {expanded ? "▼" : "▶"}
            </button>
            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-80 focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
              />
            ) : (
              <h3 className="font-bold text-[#053b50] text-base">
                {category.title}
              </h3>
            )}
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={saveCategory} className="text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-md">Save</button>
                <button onClick={() => { setEditing(false); setTitle(category.title); }} className="text-xs font-semibold bg-gray-500 text-white px-3 py-1.5 rounded-md">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowAddIndicator(true)} className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md shadow-sm">+ Indicator</button>
                <button onClick={() => setEditing(true)} className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md shadow-sm">Edit</button>
                <button onClick={deleteCategory} className="text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md shadow-sm">Delete</button>
              </>
            )}
          </div>
        </div>

        {/* BODY (Indicators) */}
        {expanded && (
          <div className="space-y-3 mt-4 border-t border-gray-200 pt-4">
            {category.indicators.length === 0 && (
              <div className="italic text-xs text-gray-400">No indicators yet.</div>
            )}
            {category.indicators
              .sort((a, b) => a.order - b.order)
              .map((indicator) => (
                <IndicatorRow
                  key={indicator.id}
                  indicator={indicator}
                  onRefresh={onRefresh}
                />
              ))}
          </div>
        )}
      </div>

      <AddIndicatorModal
        open={showAddIndicator}
        categoryId={category.id}
        onClose={() => setShowAddIndicator(false)}
        onSuccess={onRefresh}
      />
    </>
  );
}