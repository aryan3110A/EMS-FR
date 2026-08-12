'use client';

import { useEffect, useRef, useState } from 'react';
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ems_token') : null;
    if (!token) return;
    try {
      const data = await api.notifications();
      setItems(data);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();

    const token = typeof window !== 'undefined' ? localStorage.getItem('ems_token') : null;
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    if (token) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const sseUrl = `${apiBase}/notifications/sse?token=${token}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const newNotification = JSON.parse(event.data);
          setItems((prev) => {
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });
        } catch (e) {
          console.error('Failed to parse SSE notification data:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('SSE connection failed, falling back to background polling...', err);
        if (eventSource) {
          eventSource.close();
        }
        if (!fallbackInterval) {
          fallbackInterval = setInterval(load, 5 * 60 * 1000);
        }
      };
    } else {
      fallbackInterval = setInterval(load, 5 * 60 * 1000);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  // Close popup when clicking anywhere outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    load();
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
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
        <div
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{
            boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 16px 48px -8px rgb(15 23 42 / 0.18)',
            animation: 'ems-dropdown-in 0.13s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="border-b border-slate-100 px-4 py-3 font-semibold text-sm text-slate-800 flex items-center justify-between">
            <span>Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {unread} new
              </span>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">No notifications</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`border-b border-slate-50 px-4 py-3 text-sm transition-colors hover:bg-slate-50/60 ${n.readAt ? 'opacity-60' : ''}`}
              >
                <p className="text-slate-700 leading-relaxed">{n.message}</p>
                <div className="mt-1.5 flex gap-3">
                  {n.contractId && (
                    <Link
                      href={`/contracts/${n.contractId}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      View contract
                    </Link>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                      onClick={() => markRead(n.id)}
                    >
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
