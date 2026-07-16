"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddIndicatorModal({
  open,
  categoryId,
  onClose,
  onSuccess,
}: Props) {
  const [text, setText] = useState("");
  const [weight, setWeight] = useState<number | string>(1);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  // Auto-correct the number if they type something out of bounds
  const handleBlur = () => {
    let num = Number(weight);
    if (isNaN(num) || num < 1) setWeight(1);
    else if (num > 4) setWeight(4);
  };

  async function handleSubmit() {
    if (!text.trim()) {
      alert("Indicator text is required.");
      return;
    }

    const finalWeight = Number(weight);

    if (finalWeight < 1 || finalWeight > 4) {
      alert("Weight must be between 1 and 4.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/rubric/indicator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId,
          text,
          weight: finalWeight,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create indicator.");
      }

      setText("");
      setWeight(1);

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create indicator.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#053b50]">
            Add Indicator
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">
              Indicator Description
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Example: Aktif membangun kehidupan rohani yang teguh."
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-700 resize-none focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-[#053b50] text-sm mb-2">
              Max Weight / Score (1 - 4)
            </label>
            <input
              type="number"
              min={1}
              max={4}
              step={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={handleBlur}
              className="w-32 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#008397]/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-8 py-5 flex justify-end gap-3 bg-gray-50/30">
          <button
            onClick={() => {
              setText("");
              setWeight(1);
              onClose();
            }}
            className="border border-gray-300 text-gray-700 font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#008397] hover:bg-[#006e80] disabled:opacity-50 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition shadow-sm"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}