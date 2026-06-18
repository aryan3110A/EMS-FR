'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { showError } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('sales@ems.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      localStorage.setItem('ems_token', res.accessToken);
      localStorage.setItem('ems_user', JSON.stringify(res.user));
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      showError(err, 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20">
            <Globe2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Export Management System</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage contracts</p>
        </div>

        <form onSubmit={handleSubmit} className="ems-card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-slate-800">Sign in</h2>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="ems-label">Email</label>
            <input className="ems-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="ems-label">Password</label>
            <input className="ems-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="ems-btn-primary w-full py-3">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <p className="mb-2 font-semibold text-slate-700">Demo credentials</p>
          <p className="font-mono text-slate-600">sales@ems.com / admin123</p>
          <p className="font-mono text-slate-600">admin@ems.com / admin123</p>
        </div>
      </div>
    </div>
  );
}
