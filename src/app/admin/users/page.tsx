'use client';

import { useState, useEffect, FormEvent } from 'react';
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
          <Link href="/admin" className="text-gray-500 hover:text-[#008c99] font-bold transition-colors">← Go back to Live Overview</Link>
          </div>
          <Link href="/login" className="text-red-500 hover:text-red-700 text-[15px] font-bold transition-colors">
            Logout
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-12 space-y-6 pb-20">
        <button 
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="w-full bg-[#f39c12] hover:bg-[#e67e22] text-white text-2xl md:text-4xl font-extrabold py-5 md:py-6 px-8 rounded-2xl shadow-md flex items-center gap-6 transition-transform active:scale-[0.98]"
        >
          <span className="text-4xl md:text-5xl font-normal leading-none mb-1">+</span>
          Add Teacher / Staff
        </button>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center px-8 py-5 md:py-6 border-2 border-[#008c99] rounded-2xl">
            <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-600 mr-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text"
              placeholder="Search Teacher / Staff"
              value={searchQuery}m
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full outline-none text-gray-800 text-2xl md:text-4xl font-extrabold placeholder:text-gray-500 bg-transparent"
            />
          </div>

          {searchQuery && (
            <div className="border-t border-gray-100 max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 font-bold">Loading...</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold">No teachers found.</div>
              ) : (
                filteredTeachers.map(teacher => (
                  <div 
                    key={teacher.id}
                    onClick={() => openEditModal(teacher)}
                    className="p-6 flex items-start gap-6 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-24 h-24 relative rounded-md overflow-hidden bg-gray-200 flex-shrink-0 shadow-sm flex items-center justify-center text-gray-400 font-bold text-3xl">
                      {teacher.name ? teacher.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-gray-900 text-2xl">
                        {getTitle(teacher.gender)}{teacher.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg text-gray-600 font-medium">{teacher.role}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${teacher.department === 'UMUM' ? 'bg-gray-200 text-gray-700' : teacher.department === 'IPA' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {teacher.department || 'UMUM'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">NIY: {teacher.nis_niy}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================== */}
      {/* ADD TEACHER MODAL */}
      {/* ============================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#f39c12] px-6 py-4 flex justify-between items-center text-white">
              <h2 className="font-bold text-xl">Add Teacher / Staff</h2>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="p-6 flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-4">
                <InputGroup label="Nama Lengkap" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} required />
                <InputGroup label="Email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
                <SelectGroup label="Jenis Kelamin" value={formData.gender} onChange={(e: any) => setFormData({...formData, gender: e.target.value})} options={['Laki-Laki', 'Perempuan']} />
                
                {/* THE FIX IS HERE: Updated to separated roles */}
                <SelectGroup label="Jabatan/Bagian/Bidang" value={formData.role} onChange={(e: any) => setFormData({...formData, role: e.target.value})} options={['TEACHER', 'STAFF', 'DIRECTOR', 'PRINCIPAL', 'ADMIN']} />
                
                <SelectGroup label="Departemen/Jurusan" value={formData.department} onChange={(e: any) => setFormData({...formData, department: e.target.value})} options={['UMUM', 'IPA', 'IPS']} />
                
                <InputGroup label="NIY" value={formData.nis_niy} onChange={(e: any) => setFormData({...formData, nis_niy: e.target.value})} required />
              </div>

              <div className="w-full md:w-56 flex flex-col justify-between">
                <div className="w-full aspect-square bg-gray-100 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-gray-400 relative overflow-hidden mb-6">
                    <span className="font-extrabold text-7xl text-gray-300">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                    </span>
                </div>
                <button type="submit" className="w-full bg-[#f39c12] hover:bg-[#e67e22] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-wide mt-auto">
                  Add Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* EDIT / REMOVE TEACHER MODAL */}
      {/* ============================== */}
      {isEditModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#f39c12] px-6 py-4 flex justify-between items-center text-white">
              <h2 className="font-bold text-xl">Teacher / Staff ({getTitle(selectedTeacher.gender).toUpperCase()}{selectedTeacher.name.toUpperCase()})</h2>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleEdit} className="p-6 flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-4">
                <InputGroup label="Nama Lengkap" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} required />
                <InputGroup label="Email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
                <SelectGroup label="Jenis Kelamin" value={formData.gender} onChange={(e: any) => setFormData({...formData, gender: e.target.value})} options={['Laki-Laki', 'Perempuan']} />
                
                {/* Fixed here previously */}
                <SelectGroup label="Jabatan/Bagian/Bidang" value={formData.role} onChange={(e: any) => setFormData({...formData, role: e.target.value})} options={['TEACHER', 'STAFF', 'DIRECTOR', 'PRINCIPAL', 'ADMIN']} />                
                
                <SelectGroup label="Departemen/Jurusan" value={formData.department} onChange={(e: any) => setFormData({...formData, department: e.target.value})} options={['UMUM', 'IPA', 'IPS']} />
                <InputGroup label="NIY" value={formData.nis_niy} onChange={(e: any) => setFormData({...formData, nis_niy: e.target.value})} required />
              </div>

              <div className="w-full md:w-56 flex flex-col">
                <div className="w-full aspect-square bg-gray-100 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-gray-400 relative overflow-hidden mb-6">
                    <span className="font-extrabold text-7xl text-gray-300">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : selectedTeacher.name?.charAt(0).toUpperCase()}
                    </span>
                </div>
                
                <div className="flex flex-col gap-3 mt-auto">
                  <button type="submit" className="w-full bg-[#008c99] hover:bg-[#00737d] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-wide">
                    Save Changes
                  </button>
                  <button type="button" onClick={handleDelete} className="w-full bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 hover:border-red-600 hover:text-red-600 font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wide">
                    Remove
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// FORM COMPONENTS
// ==========================================

function InputGroup({ label, value, onChange, required = false }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-700 mb-1 font-bold">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-gray-200 border-none rounded py-2 px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#f39c12]"
      />
    </div>
  );
}

function SelectGroup({ label, value, onChange, options }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-700 mb-1 font-bold">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        className="w-full bg-gray-200 border-none rounded py-2 px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#f39c12] cursor-pointer appearance-none font-medium"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}