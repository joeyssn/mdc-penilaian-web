"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  sectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCategoryModal({
  open,
  sectionId,
  onClose,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (!title.trim()) {
      alert("Category title is required.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/rubric/category", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sectionId,
          title,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create category");
      }

      setTitle("");

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create category.");
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
            Add Category
          </h2>
        </div>

        {/* Body */}

        <div className="p-6 space-y-4">

          <div>

            <label className="block text-sm font-semibold mb-2">
              Category Title
            </label>

            <input
              type="text"
              placeholder="Example: Kualitas Spiritual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

          </div>

        </div>

        {/* Footer */}

        <div className="border-t px-6 py-4 flex justify-end gap-3">

          <button
            onClick={() => {
              setTitle("");
              onClose();
            }}
            className="border px-5 py-2 rounded-lg hover:bg-gray-100"
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