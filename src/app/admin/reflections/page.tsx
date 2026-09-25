'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Match this to whatever data you store in your reflection/rubric
type Reflection = {
  id: string;
  userId: string;
  // Add other rubric fields here if you want to display scores/status
  user: {
    name: string;
    className: string;
    nis_niy: string;
  };
};

export default function ManageReflectionsPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { 
    fetchReflections(); 
  }, []);

  const fetchReflections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reflections');
      const data = await res.json();
      if (!data.error) {
        setReflections(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetReflection = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to completely reset the self reflection for ${studentName}? All their rubric data will be permanently deleted.`)) return;
    
    try {
      // Reusing the reset API we built earlier!
      const res = await fetch(`/api/students/reset-reflection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      
      const result = await res.json();
      
      if (res.ok) {
        alert("Success: " + result.message);
        fetchReflections(); // Refresh the table automatically
      } else {
        alert("Error: " + result.error);
      }
    } catch (error) {
      console.error("Failed to reset", error);
      alert("An error occurred while resetting the reflection.");
    }
  };

  const filteredReflections = reflections.filter(r => 
    r.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.user?.className && r.user.className.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20 relative">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-40 border-b border-gray-200">
        <h1 className="text-xl font-extrabold text-[#053b50]">Admin Master Panel</h1>
        <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Back to Overview</Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#053b50]">Manage Self Reflections</h1>
          <p className="text-gray-500 mt-2 font-medium">Track who has completed their rubrics and reset them if needed.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <input 
            type="text" 
            placeholder="Search by student name or class..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-bold outline-none focus:border-[#008c99] transition-colors mb-6"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="py-4 px-6 font-bold text-gray-600">Student Name</th>
                  <th className="py-4 px-6 font-bold text-gray-600">NIS</th>
                  <th className="py-4 px-6 font-bold text-gray-600">Class</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold">Loading rubrics...</td></tr>
                ) : filteredReflections.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold">No completed self-reflections found.</td></tr>
                ) : (
                  filteredReflections.map((reflection) => (
                    <tr key={reflection.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900">{reflection.user?.name || 'Unknown Student'}</td>
                      <td className="py-4 px-6 text-gray-600 font-mono text-sm">{reflection.user?.nis_niy || '-'}</td>
                      <td className="py-4 px-6 text-gray-600">
                        {reflection.user?.className ? <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold text-xs">{reflection.user.className}</span> : '-'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => resetReflection(reflection.userId, reflection.user?.name)} 
                          className="text-red-500 hover:bg-red-50 font-bold text-sm px-4 py-2 rounded-lg transition-colors border border-red-100"
                        >
                          Reset Reflection
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}