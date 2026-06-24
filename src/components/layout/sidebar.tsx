'use client';

import { useEffect, useState } from 'react';
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
import { NotificationBell } from '@/components/notifications/notification-bell';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contracts', label: 'Contracts', icon: FileText },
  { href: '/contracts/new', label: 'New Contract', icon: FilePlus2 },
  { href: '/masters', label: 'Masters', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

type StoredUser = {
  name?: string;
  role?: string;
  officeName?: string;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser>({});

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('ems_user') || '{}'));
    } catch {
      setUser({});
    }
  }, []);

  function logout() {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    router.push('/login');
  }

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-[270px] shrink-0 self-start flex-col overflow-hidden border-r border-slate-200/80 bg-white shadow-[4px_0_24px_-12px_rgba(15,23,42,0.08)]">
      {/* Brand */}
      <div className="border-b border-slate-100 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-md shadow-blue-600/20">
            <Globe2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600/80">EMS Platform</p>
            <p className="text-base font-bold leading-tight text-slate-800">Export Management</p>
          </div>
        </div>
        {user.officeName && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Office</p>
            <p className="text-xs font-medium text-slate-700">{user.officeName}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Main Menu</p>
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-4 w-4 opacity-80" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-bold text-white shadow-sm">
            {(user.name || 'U')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{user.name || 'User'}</p>
            <p className="truncate text-[11px] text-slate-500">{user.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
    <div className="flex min-h-screen items-start bg-[#f4f6f9]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
