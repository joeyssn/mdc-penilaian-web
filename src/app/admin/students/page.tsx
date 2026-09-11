'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// Matches your Prisma Schema
type User = { id: string; name: string; nis_niy: string; email: string; role: string; gender?: string; className?: string; };

export default function ManageStudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!data.error) {
        setStudents(data.filter((u: User) => u.role.toUpperCase() === 'STUDENT'));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const excelData = XLSX.utils.sheet_to_json(worksheet);

        if (excelData.length === 0) {
          alert("The Excel file is empty!");
          setIsImporting(false);
          return;
        }

        const res = await fetch('/api/students/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(excelData),
        });

        const result = await res.json();
        
        if (res.ok) {
          alert(result.message);
          fetchStudents();
        } else {
          alert("Error: " + result.error);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to parse the Excel file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to completely remove this student?")) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchStudents();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  const saveStudentEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          name: editingStudent.name,
          nis_niy: editingStudent.nis_niy,
          email: editingStudent.email,
          className: editingStudent.className,
          gender: editingStudent.gender
        }),
      });

      if (res.ok) {
        setEditingStudent(null);
        fetchStudents();
      } else {
        const errorData = await res.json();
        alert("Failed to update student: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.nis_niy && s.nis_niy.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 🚀 THE NEW EXPORT FUNCTION
  const exportToExcel = () => {
    if (filteredStudents.length === 0) {
      alert("No data to export!");
      return;
    }

    const dataToExport = filteredStudents.map(student => ({
      Name: student.name,
      Email: student.email || `${student.nis_niy}@mdc.sch.id`,
      NIS: student.nis_niy,
      Class: student.className || '-',
      Gender: student.gender || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "Student_Data_Export.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#f7f8f9] font-sans pb-20 relative">
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-40 border-b border-gray-200">
        <h1 className="text-xl font-extrabold text-[#053b50]">Admin Master Panel</h1>
        <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Back to Overview</Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-10 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-[#053b50]">Manage Students</h1>
            <p className="text-gray-500 mt-2 font-medium">Total: {students.length} Students</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 🚀 THE NEW EXPORT BUTTON */}
            <button onClick={exportToExcel} className="bg-[#053b50] hover:bg-[#032a3a] text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export to Excel
            </button>

            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-[#27ae60] hover:bg-[#219653] text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {isImporting ? 'Importing...' : 'Bulk Import Excel'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <input 
            type="text" 
            placeholder="Search students by name, NIS, or class..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-bold outline-none focus:border-[#008c99] transition-colors mb-6"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="py-4 px-6 font-bold text-gray-600">Name</th>
                  <th className="py-4 px-6 font-bold text-gray-600">Email / NIS</th>
                  <th className="py-4 px-6 font-bold text-gray-600">Class</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold">Loading students...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold">No students found.</td></tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900">{student.name}</td>
                      <td className="py-4 px-6 text-gray-600 font-mono text-sm">
                        <div>{student.email}</div>
                        <div className="text-xs text-gray-400">NIS: {student.nis_niy}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {student.className ? <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold text-xs">{student.className}</span> : '-'}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2 flex justify-end">
                        <button onClick={() => setEditingStudent(student)} className="text-[#008c99] hover:bg-[#008c99]/10 font-bold text-sm px-4 py-2 rounded-lg transition-colors border border-[#008c99]/20">Edit</button>
                        <button onClick={() => deleteStudent(student.id)} className="text-red-500 hover:bg-red-50 font-bold text-sm px-4 py-2 rounded-lg transition-colors border border-red-100">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#053b50] px-6 py-4 flex justify-between items-center">
              <h2 className="text-white font-bold text-xl">Edit Student Data</h2>
              <button onClick={() => setEditingStudent(null)} className="text-gray-300 hover:text-white font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={saveStudentEdits} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                <input type="text" required value={editingStudent.name} onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-[#008c99] font-medium" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                <input type="email" required value={editingStudent.email} onChange={(e) => setEditingStudent({...editingStudent, email: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-[#008c99] font-mono text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Class Name</label>
                  <input type="text" placeholder="e.g., 10A" value={editingStudent.className || ''} onChange={(e) => setEditingStudent({...editingStudent, className: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-[#008c99] font-medium" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
                  <select value={editingStudent.gender || ''} onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-[#008c99] font-medium bg-white">
                    <option value="">Select...</option>
                    <option value="Laki-Laki">Laki-Laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setEditingStudent(null)} className="px-5 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="bg-[#008c99] hover:bg-[#007b87] text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}