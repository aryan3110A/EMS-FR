'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  Package,
  BarChart3,
  LogOut,
  Globe2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contracts', label: 'Contracts', icon: FileText },
  { href: '/contracts/new', label: 'New Contract', icon: FilePlus2 },
  { href: '/masters', label: 'Masters', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('ems_user') || '{}')
    : {};

  function logout() {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    router.push('/login');
  }

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-[270px] shrink-0 self-start flex-col overflow-hidden bg-gradient-to-b from-[#0a1628] via-[#0f2744] to-[#0a1f3d] text-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Brand */}
      <div className="relative border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30">
            <Globe2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">EMS Platform</p>
            <p className="text-base font-bold leading-tight">Export Management</p>
          </div>
        </div>
        {user.officeName && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-slate-200">{user.officeName}</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="relative flex-1 space-y-1.5 overflow-y-auto p-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Main Menu</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = (() => {
            if (href === '/dashboard') return pathname === '/dashboard';
            if (href === '/contracts/new') return pathname === '/contracts/new';
            if (href === '/contracts') {
              return pathname === '/contracts' || (pathname.startsWith('/contracts/') && pathname !== '/contracts/new');
            }
            return pathname === href || pathname.startsWith(`${href}/`);
          })();
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', active ? 'text-white' : 'text-slate-500 group-hover:text-blue-300')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-4 w-4 opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="relative border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold shadow-md">
            {(user.name || 'U')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name || 'User'}</p>
            <p className="truncate text-[11px] text-slate-400">{user.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex min-h-screen items-start bg-[#f0f4f8]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="border-b border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
