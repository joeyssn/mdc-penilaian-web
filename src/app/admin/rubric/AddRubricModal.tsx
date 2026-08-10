"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRubricModal({ open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (!title.trim()) {
      alert("Rubric title is required.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      if (!res.ok) throw new Error("Failed to create rubric");

      setTitle("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create rubric.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100">
        
        <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#053b50]">Create New Rubric</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">✕</button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">Rubric Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Evaluasi Guru 2026 Semester 1"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">Description (Optional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="border-t border-gray-100 px-8 py-5 flex justify-end gap-3 bg-gray-50/30">
          <button onClick={onClose} className="border border-gray-300 text-gray-700 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="bg-[#008397] hover:bg-[#006e80] disabled:opacity-50 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition shadow-sm">
            {loading ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
