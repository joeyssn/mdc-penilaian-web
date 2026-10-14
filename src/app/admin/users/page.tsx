'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  nis_niy: string;
  role: string;
  email?: string | null;
  gender?: string | null;
  department?: string | null; 
};

export default function TeacherManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '', 
    gender: 'Laki-Laki', 
    role: 'TEACHER',
    department: 'UMUM', 
    nis_niy: ''
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teachers');
      const data = await res.json();
      if (!data.error && Array.isArray(data)) {
        setTeachers(data);
      } else {
        setTeachers([]);
      }
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
      setTeachers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (gender?: string | null) => {
    if (gender === 'Laki-Laki') return 'Mr. ';
    if (gender === 'Perempuan') return "Ma'am ";
    return '';
  };

  // --- EXCEL IMPORT HANDLER ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const importData = new FormData();
    importData.append('file', file);

    try {
      // Assuming you have an API route set up to parse the Excel file
      const res = await fetch('/api/teachers/import', {
        method: 'POST',
        body: importData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to import data.");
      } else {
        alert("Teachers imported successfully!");
        fetchTeachers();
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Something went wrong during import.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input for future uploads
      }
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      alert(data.error || "Something went wrong.");
      return; 
    }

    setIsAddModalOpen(false);
    resetForm();
    fetchTeachers(); 
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    const res = await fetch('/api/teachers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedTeacher.id, ...formData }),
    });
    
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Something went wrong.");
      return;
    }

    setIsEditModalOpen(false);
    resetForm();
    fetchTeachers(); 
  };

  const handleDelete = async () => {
    if (!selectedTeacher) return;
    const confirmDelete = confirm(`Are you sure you want to remove ${selectedTeacher.name}?`);
    if (!confirmDelete) return;

    await fetch('/api/teachers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedTeacher.id }),
    });
    setIsEditModalOpen(false);
    resetForm();
    fetchTeachers(); 
  };

  const openEditModal = (teacher: User) => {
    setSelectedTeacher(teacher);
    setFormData({
      name: teacher.name || '',
      email: teacher.email || '', 
      gender: teacher.gender || 'Laki-Laki', 
      role: teacher.role || 'TEACHER',
      department: teacher.department || 'UMUM', 
      nis_niy: teacher.nis_niy || ''
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', gender: 'Laki-Laki', role: 'TEACHER', department: 'UMUM', nis_niy: '' });
    setSelectedTeacher(null);
  };

  const filteredTeachers = teachers.filter(t => {
    if (!t) return false;
    const teacherName = t.name || '';
    const teacherNisNiy = t.nis_niy || '';
    const fullNameWithTitle = `${getTitle(t.gender)}${teacherName}`.toLowerCase();
    
    return fullNameWithTitle.includes(searchQuery.toLowerCase()) || 
           teacherNisNiy.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans">
      
      <nav className="bg-white py-4 px-6 md:px-12 shadow-sm flex justify-between items-center z-50 relative border-b border-gray-200">
        <div className="flex items-center">
          <Image src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" alt="MDC" width={220} height={55} className="h-10 md:h-12 w-auto" priority />
        </div>
        
        <div className="flex items-center gap-10">
          <div className="hidden md:flex gap-8 text-[15px] font-bold text-gray-500">
          <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Dashboard</Link>
          </div>
          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-6 pb-20">
        
        {/* ACTION BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          
          {/* Search */}
          <div className="relative w-full md:w-96">
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text"
              placeholder="Search by name or NIY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-700 font-medium focus:ring-2 focus:ring-[#008c99] transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Hidden File Input */}
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleExcelImport}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-bold py-2.5 px-5 rounded-xl transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {isImporting ? 'Importing...' : 'Import Excel'}
            </button>

            <button 
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#f39c12] hover:bg-[#e67e22] text-white font-bold py-2.5 px-5 rounded-xl transition-transform active:scale-95 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Single
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">NIY</th>
                  <th className="px-6 py-4 font-bold">Role</th>
                  <th className="px-6 py-4 font-bold">Department</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">Loading...</td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">No data found.</td>
                  </tr>
                ) : (
                  filteredTeachers.map(teacher => (
                    <tr key={teacher.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold flex-shrink-0">
                            {teacher.name ? teacher.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{getTitle(teacher.gender)}{teacher.name}</p>
                            <p className="text-xs text-gray-500">{teacher.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">
                        {teacher.nis_niy}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-700">
                          {teacher.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          teacher.department === 'UMUM' ? 'bg-gray-100 text-gray-700' : 
                          teacher.department === 'IPA' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {teacher.department || 'UMUM'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openEditModal(teacher)}
                          className="text-[#008c99] hover:text-[#005f69] font-bold text-sm bg-[#008c99]/10 hover:bg-[#008c99]/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Edit
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

      {/* Add Modal */}
      {isAddModalOpen && (
         <ModalWrapper title="Add Teacher / Staff" onClose={() => setIsAddModalOpen(false)}>
            <TeacherForm 
              formData={formData} 
              setFormData={setFormData} 
              onSubmit={handleAdd} 
              submitLabel="Add Data" 
              submitColor="bg-[#f39c12] hover:bg-[#e67e22]"
            />
         </ModalWrapper>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedTeacher && (
         <ModalWrapper title={`Edit Data: ${selectedTeacher.name}`} onClose={() => setIsEditModalOpen(false)}>
            <TeacherForm 
              formData={formData} 
              setFormData={setFormData} 
              onSubmit={handleEdit} 
              submitLabel="Save Changes" 
              submitColor="bg-[#008c99] hover:bg-[#00737d]"
              onDelete={handleDelete}
            />
         </ModalWrapper>
      )}

    </div>
  );
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================

function ModalWrapper({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center text-gray-800">
          <h2 className="font-bold text-lg">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TeacherForm({ formData, setFormData, onSubmit, submitLabel, submitColor, onDelete }: any) {
  return (
    <form onSubmit={onSubmit} className="p-6 flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <InputGroup label="Nama Lengkap" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <InputGroup label="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
        <SelectGroup label="Jenis Kelamin" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} options={['Laki-Laki', 'Perempuan']} />
        <SelectGroup label="Jabatan/Bagian" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} options={['TEACHER', 'STAFF', 'DIRECTOR', 'PRINCIPAL', 'ADMIN']} />                
        <SelectGroup label="Departemen/Jurusan" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} options={['UMUM', 'IPA', 'IPS']} />
        <InputGroup label="NIY / NIS" value={formData.nis_niy} onChange={(e) => setFormData({...formData, nis_niy: e.target.value})} required />
      </div>

      <div className="w-full md:w-48 flex flex-col gap-3 justify-end mt-4 md:mt-0">
        <button type="submit" className={`w-full text-white font-bold py-3 rounded-xl transition-transform active:scale-95 text-sm tracking-wide ${submitColor}`}>
          {submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="w-full bg-white border border-red-200 text-red-500 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors text-sm tracking-wide">
            Remove Data
          </button>
        )}
      </div>
    </form>
  );
}

function InputGroup({ label, value, onChange, required = false }: any) {
  return (
    
    <div className="flex flex-col">
      <label className="text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wider">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#008c99] transition-all"
      />
    </div>
  );
}

function SelectGroup({ label, value, onChange, options }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wider">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#008c99] transition-all cursor-pointer font-medium"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}