"use client";

import { useState } from "react";
import { RubricIndicator } from "./types";

interface Props {
  indicator: RubricIndicator;
  index: number; // <--- Accept the index prop
  onRefresh: () => void;
}

export default function IndicatorRow({ indicator, index, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);

  const [text, setText] = useState(indicator.text);
  const [weight, setWeight] = useState<number | string>(indicator.weight);

  const handleBlur = () => {
    let num = Number(weight);
    if (isNaN(num) || num < 1) setWeight(4);
    else if (num > 4) setWeight(4);
  };

  async function saveIndicator() {
    const finalWeight = Number(weight);
    
    if (finalWeight < 1 || finalWeight > 4) {
      alert("Weight must be between 1 and 4.");
      return;
    }

    try {
      await fetch("/api/rubric/indicator", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: indicator.id,
          text,
          weight: finalWeight,
        }),
      });

      setEditing(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update indicator.");
    }
  }

  async function deleteIndicator() {
    const ok = confirm("Delete this indicator?\n\nThis action cannot be undone.");
    if (!ok) return;

    try {
      await fetch("/api/rubric/indicator", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: indicator.id,
        }),
      });

      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete indicator.");
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 hover:shadow-md transition duration-200">
      {!editing ? (
        <div className="flex justify-between items-start gap-4">
          
          {/* UPDATED: Added the Q1, Q2 badge next to the text */}
          <div className="flex-1 flex gap-3 items-start">
            <span className="text-xs font-bold text-white bg-[#008397] px-2 py-1 rounded shadow-sm mt-0.5 shrink-0">
              Q{index + 1}
            </span>
            <div>
              <div className="font-medium text-slate-700 text-sm leading-relaxed">
                {indicator.text}
              </div>
              <div className="mt-2 text-xs text-gray-500 font-medium bg-gray-50 inline-block px-2.5 py-1 rounded-md border border-gray-100">
                Max Score:
                <span className="font-bold text-[#053b50] ml-1.5">
                  {indicator.weight}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 ml-4 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={deleteIndicator}
              className="text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md shadow-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">
              Indicator Description
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#008397]/50 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">
              Score Limit (Min: 1, Max: 4)
            </label>
            <input
              type="number"
              min={1}
              max={4}
              step={4}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={handleBlur}
              className="border border-gray-200 rounded-lg px-3 py-2 w-32 text-sm focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setEditing(false);
                setText(indicator.text);
                setWeight(indicator.weight);
              }}
              className="text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition"
            >
              Cancel
            </button>
            <button
              onClick={saveIndicator}
              className="text-xs font-semibold bg-[#008397] hover:bg-[#006e80] text-white px-4 py-2 rounded-md transition"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}