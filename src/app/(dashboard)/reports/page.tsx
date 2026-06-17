'use client';

import { AppShell } from '@/components/layout/sidebar';

export default function ReportsPage() {
  return (
    <AppShell title="Reports">
      <div className="ems-card p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-800">Month-Wise Order List PDF</h2>
        <p className="mt-2 text-sm text-slate-500">Coming in Phase 2 — filter by month, shipment half, EU/Non-EU, export PDF</p>
      </div>
    </AppShell>
  );
}
