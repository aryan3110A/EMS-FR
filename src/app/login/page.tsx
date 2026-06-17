'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ahmedabad@ems.com');
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
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-[#0f2744] p-12 text-white lg:flex">
        <div>
          <p className="text-sm font-medium text-blue-300">Export Management System</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Inventory, Contract,<br />Production & Dispatch
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Ahmedabad office contract management. Salespersons (Jyoti, Brahma Sir) provide orders by phone — office staff enter contracts here.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">Demo credentials</p>
          <p className="mt-2 font-mono text-sm">ahmedabad@ems.com / admin123</p>
          <p className="font-mono text-sm">admin@ems.com / admin123</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Ahmedabad Contract Office</p>
          </div>

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
      </div>
    </div>
  );
}
