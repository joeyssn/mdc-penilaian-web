"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  rubricId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSectionModal({
  open,
  rubricId,
  onClose,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (!title.trim()) {
      alert("Section title is required.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/rubric/section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rubricId,
          title,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create section.");
      }

      setTitle("");

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create section.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">

        {/* Header */}

        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-bold">
            Add Section
          </h2>
        </div>

        {/* Body */}

        <div className="p-6">

          <label className="block text-sm font-semibold mb-2">
            Section Title
          </label>

          <input
            type="text"
            placeholder="Example: Kerohanian"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

        </div>

        {/* Footer */}

        <div className="border-t px-6 py-4 flex justify-end gap-3">

          <button
            onClick={() => {
              setTitle("");
              onClose();
            }}
            className="px-5 py-2 rounded-lg border hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg"
          >
            {loading ? "Saving..." : "Save"}
          </button>

        </div>

      </div>

    </div>
  );
}