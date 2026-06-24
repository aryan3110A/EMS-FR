'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

type Notification = {
  id: string;
  message: string;
  contractId?: string;
  createdAt: string;
  readAt?: string | null;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    try {
      const data = await api.notifications();
      setItems(data);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2 font-semibold text-sm">Notifications</div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">No notifications</li>
            )}
            {items.map((n) => (
              <li key={n.id} className={`border-b border-slate-50 px-4 py-3 text-sm ${n.readAt ? 'opacity-60' : ''}`}>
                <p>{n.message}</p>
                <div className="mt-1 flex gap-2">
                  {n.contractId && (
                    <Link href={`/contracts/${n.contractId}`} className="text-xs text-blue-600 hover:underline">
                      View contract
                    </Link>
                  )}
                  {!n.readAt && (
                    <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
