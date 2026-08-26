'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  
  // We use "email" here to match what your /api/login expects in the database
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Automatically log out of old sessions when visiting the login page
  useEffect(() => {
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Attempt to log in using our custom API route
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        // 2. Redirect based on the user's role from the database
        if (data.role === 'ADMIN') {
          router.push('/admin');
        } else if (data.role === 'STUDENT') {
          router.push('/student');
        } else if (data.role === 'TEACHER') {
          router.push('/teachers');
        }
        else if (data.role === 'STAFF') {
          router.push('/teachers');
        }
        else if (data.role === 'PRINCIPAL') {
          router.push('/principal');
        }
        else if (data.role === 'DIRECTOR') {
          router.push('/director');
        }
        else if (data.role === 'VICE_PRINCIPAL_KESISWAAN') {
          router.push('/vice-principal');
        }
        else if (data.role === 'VICE_PRINCIPAL_KURIKULUM') {
          router.push('/vice-principal');
        }
        else if (data.role === 'KARYAWAN') {  
          router.push('/karyawan');
        }
      } else {
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center" suppressHydrationWarning>
      {error && (
        <div className="bg-red-500/90 text-white w-full px-4 py-3 rounded text-sm text-center shadow-lg mb-4">
          {error}
        </div>
      )}

      {/* Input Group */}
      <div className="w-full space-y-1">
        <input
          id="email"
          type="text"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          suppressHydrationWarning
          // Changed shadow-md to shadow-2xl shadow-black/20 for a massive pop
          className="w-full px-6 py-4 bg-white text-gray-900 border-2 border-[#d49a37] rounded-t-xl focus:ring-2 focus:ring-[#008c99] focus:border-transparent outline-none transition-all placeholder:text-[#d49a37] shadow-2xl shadow-black/20 font-medium"
          placeholder="E-mail"
        />
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          suppressHydrationWarning
          // Changed shadow-md to shadow-2xl shadow-black/20
          className="w-full px-6 py-4 bg-white text-gray-900 border-2 border-[#d49a37] rounded-b-xl focus:ring-2 focus:ring-[#008c99] focus:border-transparent outline-none transition-all placeholder:text-[#d49a37] shadow-2xl shadow-black/20 font-medium"
          placeholder="Password"
        />
      </div>

      {/* Button */}
      <button
        type="submit"
        disabled={isLoading}
        suppressHydrationWarning
        // Upgraded to shadow-xl, and it expands to shadow-2xl on hover
        className="mt-8 w-64 py-3.5 bg-[#008c99] hover:bg-[#00737d] text-white text-lg font-bold rounded-xl shadow-xl hover:shadow-2xl shadow-black/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}