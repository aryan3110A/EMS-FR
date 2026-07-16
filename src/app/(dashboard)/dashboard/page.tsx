'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { DashboardSkeleton } from '@/components/ui/page-loader';
import { EmsSelect } from '@/components/ui/ems-select';
import { UpcomingProductChart } from '@/components/dashboard/upcoming-product-chart';
import { ShippedProductChart } from '@/components/dashboard/shipped-product-chart';
import { api } from '@/lib/api';
import { formatDate, statusBadge, statusLabel } from '@/lib/utils';
import {
  FileText,
  Clock,
  CheckCircle,
  Factory,
  Ship,
  Anchor,
  Calendar,
  Filter,
  X,
  AlertCircle,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (start === end) {
      setCount(end);
      return;
    }
    const step = Math.max(Math.ceil((end - start) / (duration / 16)), 1);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className="tabular-nums">{count}</span>;
}

export default function DashboardPage() {
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
  const isOwner = ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(user.role);

  // Filter States
  const [dateFilterType, setDateFilterType] = useState<string>('next30'); // next30, currentMonth, previousMonth, custom, all
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [buyerId, setBuyerId] = useState<string>('');
  const [destinationPortId, setDestinationPortId] = useState<string>('');
  const [contractStatus, setContractStatus] = useState<string>('');
  const [containerStatus, setContainerStatus] = useState<string>('');
  const [shipmentPeriod, setShipmentPeriod] = useState<string>('');
  const [euClassification, setEuClassification] = useState<string>('');
  const [salespersonId, setSalespersonId] = useState<string>('');
  const [superSalesUserId, setSuperSalesUserId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  // Dropdown list states loaded from API
  const [products, setProducts] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [superSalesUsers, setSuperSalesUsers] = useState<any[]>([]);

  // Selected product state for insights panel
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);

  // Drilldown Modal State
  const [drilldownProduct, setDrilldownProduct] = useState<any | null>(null);
  const [paymentDrilldown, setPaymentDrilldown] = useState(false);
  const [drilldownType, setDrilldownType] = useState<'upcoming' | 'shipped'>('upcoming');

  // Stats Data
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const filteredShipments = stats?.upcoming?.shipments || [];

  // Compute start and end dates based on Quick range
  const computedParams = useMemo(() => {
    const params: Record<string, any> = {
      productId,
      buyerId,
      destinationPortId,
      contractStatus,
      containerStatus,
      shipmentPeriod,
      euClassification,
      salespersonId,
      superSalesUserId,
      paymentStatus,
    };

    const today = new Date();
    if (dateFilterType === 'next30') {
      const future = new Date(today);
      future.setDate(future.getDate() + 30);
      params.startDate = today.toISOString().split('T')[0];
      params.endDate = future.toISOString().split('T')[0];
    } else if (dateFilterType === 'currentMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      params.startDate = firstDay.toISOString().split('T')[0];
      params.endDate = lastDay.toISOString().split('T')[0];
    } else if (dateFilterType === 'previousMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      params.startDate = firstDay.toISOString().split('T')[0];
      params.endDate = lastDay.toISOString().split('T')[0];
    } else if (dateFilterType === 'custom') {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }
    // 'all' has no date parameters
    return params;
  }, [
    dateFilterType,
    startDate,
    endDate,
    productId,
    buyerId,
    destinationPortId,
    contractStatus,
    containerStatus,
    shipmentPeriod,
    euClassification,
    salespersonId,
    superSalesUserId,
    paymentStatus,
  ]);

  // Load Dropdowns
  useEffect(() => {
    Promise.all([
      api.masters.products().catch(() => []),
      api.masters.buyers().catch(() => []),
      api.masters.ports().catch(() => []),
      api.masters.salespersons().catch(() => []),
      api.masters.users('SUPER_SALES').catch(() => []),
    ]).then(([prodList, buyerList, portList, spList, ssList]) => {
      setProducts(prodList);
      setBuyers(buyerList);
      setPorts(portList);
      setSalespersons(spList);
      setSuperSalesUsers(ssList);
    });
  }, []);

  // Fetch Dashboard Stats
  useEffect(() => {
    setLoading(true);
    api.dashboard(computedParams)
      .then((res) => {
        setStats(res);
      })
      .catch((err) => {
        console.error('Failed to load dashboard statistics', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [computedParams]);

  // Client-side computations for Selected Product Insights
  const productInsights = useMemo(() => {
    if (!selectedProductCode || !stats?.allContainers) return null;

    const pCode = selectedProductCode;
    const containers = (stats.allContainers as any[]).filter(
      (c) => c.product?.code === pCode
    );

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const next30Limit = new Date(today);
    next30Limit.setDate(next30Limit.getDate() + 30);

    const filterRangeStart = computedParams.startDate ? new Date(computedParams.startDate) : null;
    const filterRangeEnd = computedParams.endDate ? new Date(computedParams.endDate) : null;

    let inCurrentMonth = 0;
    let inUpcoming30 = 0;
    let inFilterRange = 0;
    let upToCurrentDate = 0;
    let totalMt = 0;
    const contracts = new Set<string>();
    const contractMap: Record<string, string> = {};

    containers.forEach((c) => {
      totalMt += c.quantityMt ?? 0;
      if (c.contract?.contractNumber) {
        contracts.add(c.contract.contractNumber);
        contractMap[c.contract.contractNumber] = c.contractId;
      }

      const refDate = c.expectedShipmentDate ? new Date(c.expectedShipmentDate) : null;
      if (refDate) {
        if (refDate >= currentMonthStart && refDate <= currentMonthEnd) {
          inCurrentMonth += 1;
        }
        if (refDate >= today && refDate <= next30Limit) {
          inUpcoming30 += 1;
        }
        if (refDate <= today) {
          upToCurrentDate += 1;
        }
        if (filterRangeStart && filterRangeEnd && refDate >= filterRangeStart && refDate <= filterRangeEnd) {
          inFilterRange += 1;
        }
      }
    });

    return {
      productCode: pCode,
      productName: containers[0]?.product?.name || pCode,
      inCurrentMonth,
      inUpcoming30,
      inFilterRange,
      upToCurrentDate,
      totalMt,
      contracts: [...contracts],
      contractMap,
    };
  }, [selectedProductCode, stats, computedParams]);

  // Compute circular progress values
  const totalContainersCount = stats?.allContainers?.length || 0;
  const shippedContainersCount = stats?.containersShipped || 0;
  const progressPercent = totalContainersCount > 0 ? Math.min(Math.round((shippedContainersCount / totalContainersCount) * 100), 100) : 0;

  // Active contracts count (statuses other than DRAFT and CLOSED/SHIPPED)
  const activeContractsCount = stats?.recent?.filter(
    (c: any) => !['DRAFT', 'CANCELLED', 'SHIPPED'].includes(c.status)
  ).length || 0;

  // Render drill down list in modal
  const drilldownData = useMemo(() => {
    if (!drilldownProduct || !stats) return [];
    const code = drilldownProduct.code;

    if (drilldownType === 'upcoming') {
      const upcoming = stats.upcoming?.shipments ?? [];
      return upcoming.filter((s: any) => s.product === code);
    } else {
      // Find shipped containers for this product
      const allC = stats.allContainers ?? [];
      return allC.filter((c: any) => c.product?.code === code && (c.dispatchStatus === 'SHIPPED' || c.dispatchStatus === 'DISPATCHED'));
    }
  }, [drilldownProduct, drilldownType, stats]);

  if (loading && !stats) {
    return (
      <AppShell title="Dashboard">
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      {/* Upper Panel: Filters & Owners Audit Log Navigation */}
      {isOwner && (
        <div className="flex justify-end">
          <Link href="/audit" className="ems-btn-secondary text-xs flex items-center gap-1">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            System Audit Logs
          </Link>
        </div>
      )}

      {/* Grid Filter Options */}
      <div className="mt-0 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div>
          <label className="text-xs font-semibold text-slate-500">Quick Date Filter</label>
          <EmsSelect
            value={dateFilterType}
            onChange={(v) => setDateFilterType(v)}
            options={[
              { value: 'next30', label: 'Upcoming 30 Days (Default)' },
              { value: 'currentMonth', label: 'Current Month' },
              { value: 'previousMonth', label: 'Previous Month' },
              { value: 'custom', label: 'Custom Date Range' },
              { value: 'all', label: 'All Time' },
            ]}
            className="mt-1"
          />
        </div>

        {dateFilterType === 'custom' && (
          <>
            <div>
              <label className="text-xs font-semibold text-slate-500">Start Date</label>
              <input
                type="date"
                className="ems-input mt-1 w-full text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">End Date</label>
              <input
                type="date"
                className="ems-input mt-1 w-full text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500">Product</label>
          <EmsSelect
            value={productId}
            onChange={(v) => {
              setProductId(v);
              const prod = products.find((p) => p.id === v);
              setSelectedProductCode(prod ? prod.code : null);
            }}
            options={[
              { value: '', label: 'All Products' },
              ...products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
            ]}
            searchable
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Buyer</label>
          <EmsSelect
            value={buyerId}
            onChange={(v) => setBuyerId(v)}
            options={[
              { value: '', label: 'All Buyers' },
              ...buyers.map((b) => ({ value: b.id, label: `${b.name}${b.code ? ' (' + b.code + ')' : ''}` })),
            ]}
            searchable
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Destination Port</label>
          <EmsSelect
            value={destinationPortId}
            onChange={(v) => setDestinationPortId(v)}
            options={[
              { value: '', label: 'All Ports' },
              ...ports.map((p) => ({ value: p.id, label: p.name })),
            ]}
            searchable
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Contract Status</label>
          <EmsSelect
            value={contractStatus}
            onChange={(v) => setContractStatus(v)}
            options={[
              { value: '', label: 'All Contract Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'UNDER_PREPARATION', label: 'Under Preparation' },
              { value: 'AWAITING_SIGNED', label: 'Awaiting Signed' },
              { value: 'CONFIRMED_FOR_PRODUCTION', label: 'Confirmed for Production' },
              { value: 'IN_PRODUCTION', label: 'In Production' },
              { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Container Status</label>
          <EmsSelect
            value={containerStatus}
            onChange={(v) => setContainerStatus(v)}
            options={[
              { value: '', label: 'All Container Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'UNDER_PREPARATION', label: 'Under Preparation' },
              { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
              { value: 'DISPATCHED_FROM_FACTORY', label: 'Dispatched from Factory' },
              { value: 'REACHED_PORT', label: 'Reached Port' },
              { value: 'SHIPPED', label: 'Shipped' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'ON_HOLD', label: 'On Hold' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'PLANNED', label: 'Planned (legacy)' },
            ]}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Salesperson Responsible</label>
          <EmsSelect
            value={salespersonId}
            onChange={(v) => setSalespersonId(v)}
            options={[
              { value: '', label: 'All Salespersons' },
              ...salespersons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            searchable
            className="mt-1"
          />
        </div>

        {user.role !== 'SUPER_SALES' && (
          <div>
            <label className="text-xs font-semibold text-slate-500">Super Sales</label>
            <EmsSelect
              value={superSalesUserId}
              onChange={(v) => setSuperSalesUserId(v)}
              options={[
                { value: '', label: 'All Super Sales' },
                ...superSalesUsers.map((u) => ({ value: u.id, label: u.name })),
              ]}
              searchable
              className="mt-1"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500">Payment Status</label>
          <EmsSelect
            value={paymentStatus}
            onChange={(v) => setPaymentStatus(v)}
            options={[
              { value: '', label: 'All Payment Statuses' },
              { value: 'NOT_RAISED', label: 'Not Raised' },
              { value: 'INVOICE_RAISED', label: 'Invoice Raised' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'PARTIAL', label: 'Partial' },
              { value: 'RECEIVED', label: 'Received' },
              { value: 'OVERDUE', label: 'Overdue' },
            ]}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Shipment Period</label>
          <EmsSelect
            value={shipmentPeriod}
            onChange={(v) => setShipmentPeriod(v)}
            options={[
              { value: '', label: 'All Periods' },
              { value: 'FIRST_HALF', label: 'First Half (1–15)' },
              { value: 'SECOND_HALF', label: 'Second Half (16–End)' },
            ]}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">EU / Non-EU</label>
          <EmsSelect
            value={euClassification}
            onChange={(v) => setEuClassification(v)}
            options={[
              { value: '', label: 'All Locations' },
              { value: 'EU', label: 'EU Countries' },
              { value: 'NON_EU', label: 'Non-EU Countries' },
            ]}
            className="mt-1"
          />
        </div>
      </div>

      {/* Data Section — shows loading overlay on filter change */}
      <div className="relative">
        {/* Filter-change loading overlay (not shown on initial load) */}
        {loading && stats && (
          <div className="absolute inset-0 z-20 flex items-start justify-center rounded-xl pt-16 pointer-events-none">
            <div className="flex items-center gap-3 rounded-full bg-white/90 px-5 py-2.5 shadow-lg border border-slate-200/80 backdrop-blur-sm">
              <svg className="h-4 w-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-slate-600">Updating...</span>
            </div>
          </div>
        )}

        <div
          className="transition-opacity duration-300"
          style={{ opacity: loading && stats ? 0.45 : 1 }}
        >

      {/* KPI Cards Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Upcoming Containers</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            <AnimatedCounter value={stats?.upcoming?.totalContainers ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Upcoming MT</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            <AnimatedCounter value={stats?.upcoming?.totalMt ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Active Contracts</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            <AnimatedCounter value={activeContractsCount} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Under Preparation</p>
          <p className="mt-2 text-3xl font-bold text-amber-500">
            <AnimatedCounter value={stats?.underPreparation ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Reaching Port</p>
          <p className="mt-2 text-3xl font-bold text-rose-500">
            <AnimatedCounter value={stats?.containersReachedPort ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Containers Shipped</p>
          <p className="mt-2 text-3xl font-bold text-sky-600">
            <AnimatedCounter value={stats?.containersShipped ?? 0} />
          </p>
        </div>
      </div>

      {/* Payment summary */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="ems-card cursor-pointer p-5 border border-slate-100 hover:shadow-md transition-all" onClick={() => setPaymentDrilldown(true)}>
          <p className="text-xs font-semibold text-slate-500">Total Invoice Amount</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            <AnimatedCounter value={stats?.payment?.totalInvoiceAmount ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100 hover:shadow-md transition-all">
          <p className="text-xs font-semibold text-slate-500">Payment Received</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            <AnimatedCounter value={stats?.payment?.totalReceived ?? 0} />
          </p>
        </div>
        <div className="ems-card cursor-pointer p-5 border border-slate-100 hover:shadow-md transition-all" onClick={() => setPaymentDrilldown(true)}>
          <p className="text-xs font-semibold text-slate-500">Remaining Payment</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            <AnimatedCounter value={stats?.payment?.totalRemaining ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500">Pending Invoices</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            <AnimatedCounter value={stats?.payment?.byStatus?.find((s: any) => s.status === 'PENDING')?.count ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500">Partial Paid</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            <AnimatedCounter value={stats?.payment?.byStatus?.find((s: any) => s.status === 'PARTIAL')?.count ?? 0} />
          </p>
        </div>
        <div className="ems-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500">Fully Paid</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            <AnimatedCounter value={stats?.payment?.byStatus?.find((s: any) => s.status === 'RECEIVED')?.count ?? 0} />
          </p>
        </div>
      </div>

      {(stats?.scopedToSuperSales || (stats?.salespersonBreakdown?.length ?? 0) > 0) && (
        <div className="mt-4 ems-card p-5 border border-slate-100">
          {stats?.scopedToSuperSales && (
            <p className="mb-3 text-sm text-slate-600">
              Showing contracts you created as Super Sales. Salesperson credit is equal across tagged people.
            </p>
          )}
          <h3 className="mb-3 font-semibold text-slate-800">Salesperson Breakdown (equal credit)</h3>
          {(stats?.salespersonBreakdown?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No salesperson attributions in this filter range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="ems-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th>Contracts</th>
                    <th>Total MT</th>
                    <th>Containers</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.salespersonBreakdown as any[]).map((row) => (
                    <tr key={row.salespersonId}>
                      <td className="font-medium">{row.name}</td>
                      <td>{row.contracts}</td>
                      <td>{Number(row.totalMt ?? 0).toFixed(3)}</td>
                      <td>{row.containers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {paymentDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Remaining Payment — Contributing Invoices</h3>
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setPaymentDrilldown(false)}>Close</button>
            </div>
            <table className="ems-table w-full">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Contract</th>
                  <th>Container</th>
                  <th>Buyer</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.payment?.remainingInvoices ?? []).map((inv: any, i: number) => (
                  <tr key={i}>
                    <td>{inv.invoiceNumber || '—'}</td>
                    <td>
                      <Link href={`/contracts/${inv.contractId}`} className="text-blue-600 hover:underline">
                        {inv.contractNumber}
                      </Link>
                    </td>
                    <td>{inv.containerIndex}</td>
                    <td>{inv.buyer}</td>
                    <td>{inv.remainingAmount}</td>
                    <td>{inv.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Center Layout: Charts, Circular Progress, and Selected Product Insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Upcoming Containers Chart */}
        <div className="ems-card p-5 lg:col-span-2 border border-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500 animate-pulse" />
              Upcoming Containers by Product (Expected Shipment)
            </h3>
            <span className="text-xs text-slate-400">Click a bar to view detail drilldown</span>
          </div>
          {stats?.upcoming && (
            <UpcomingProductChart
              data={stats.upcoming.byProduct}
              selected={selectedProductCode}
              onSelect={(row) => {
                setSelectedProductCode(row.code);
                setDrilldownProduct(row);
                setDrilldownType('upcoming');
              }}
            />
          )}
        </div>

        {/* Circular Progress & KPI Summary */}
        <div className="ems-card p-5 border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 mb-4">Overall Completion Progress</h3>
            <div className="relative flex items-center justify-center py-6">
              <svg className="h-36 w-36 transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  className="text-slate-100"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  className="text-indigo-500 transition-all duration-1000 ease-out"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={2 * Math.PI * 60 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-slate-800">{progressPercent}%</span>
                <span className="text-xs text-slate-400">Shipped</span>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-2">
            <div className="flex justify-between">
              <span>Total Planned Containers:</span>
              <span className="font-semibold text-slate-700">{totalContainersCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Fully Shipped/Dispatched:</span>
              <span className="font-semibold text-indigo-600">{shippedContainersCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Shipped Quantity Chart & Selected Product Insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Shipped Quantity Chart */}
        <div className="ems-card p-5 lg:col-span-2 border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Shipped Product quantities (DISPATCHED or SHIPPED)
          </h3>
          {stats?.shipped && (
            <ShippedProductChart
              data={stats.shipped.byProduct}
              selected={selectedProductCode}
              onSelect={(row) => {
                setSelectedProductCode(row.code);
                setDrilldownProduct(row);
                setDrilldownType('shipped');
              }}
            />
          )}
        </div>

        {/* Product Insights Panel */}
        <div className="ems-card p-5 border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">Product Insights</h3>
          {productInsights ? (
            <div className="space-y-4">
              <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                <p className="text-xs text-indigo-500 uppercase tracking-wider font-semibold">Active Product</p>
                <p className="text-lg font-bold text-slate-800">{productInsights.productCode} — {productInsights.productName}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Containers in Current Month:</span>
                  <span className="font-bold text-slate-700">{productInsights.inCurrentMonth}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Containers in Next 30 Days:</span>
                  <span className="font-bold text-slate-700">{productInsights.inUpcoming30}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Containers in Filter Range:</span>
                  <span className="font-bold text-indigo-600">{productInsights.inFilterRange}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Containers Up to Current Date:</span>
                  <span className="font-bold text-slate-700">{productInsights.upToCurrentDate}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Total Quantity:</span>
                  <span className="font-bold text-slate-700">{productInsights.totalMt.toFixed(2)} MT</span>
                </div>
              </div>

              {productInsights.contracts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Contributing Contracts:</p>
                  <div className="flex flex-wrap gap-2">
                    {productInsights.contracts.map((cNum) => (
                      <Link
                        key={cNum}
                        href={`/contracts/${productInsights.contractMap[cNum]}`}
                        className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-600 font-semibold hover:bg-indigo-100 transition-colors"
                      >
                        {cNum}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">Select a product from filters or click a chart bar to view detailed container counts and contracts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Shipments Table */}
      {stats?.upcoming && (
        <div className="mt-6 ems-card border border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Upcoming Shipments List
            </h2>
            <span className="text-xs text-slate-400">
              Showing expected shipments from <strong>{formatDate(stats.upcoming.from)}</strong> to <strong>{formatDate(stats.upcoming.to)}</strong>
            </span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
            <table className="ems-table w-full">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th>Expected Date</th>
                  <th>Contract</th>
                  <th>Container</th>
                  <th>Buyer</th>
                  <th>Product</th>
                  <th>Quantity / MT</th>
                  <th>Destination Port</th>
                  <th>Shipment Period</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((s: any) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.expectedShipmentDate)}</td>
                    <td className="font-bold text-indigo-600">{s.contractNumber}</td>
                    <td>Container {s.containerIndex}</td>
                    <td>{s.buyer ?? '—'}</td>
                    <td>{s.product ?? '—'}</td>
                    <td>{s.quantityMt ?? '—'}</td>
                    <td>{s.destinationPort ?? '—'}</td>
                    <td>{s.shipmentHalf === 'FIRST_HALF' ? '1–15' : s.shipmentHalf === 'SECOND_HALF' ? '16–end' : '—'}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.status ?? '')}`}>
                        {statusLabel(s.status ?? '')}
                      </span>
                    </td>
                    <td>
                      <Link href={`/contracts/${s.contractId}`} className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-0.5">
                        View Contract <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filteredShipments.length && (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400">No shipments match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>{/* end transition-opacity */}
      </div>{/* end relative wrapper */}

      {/* Drill-down Modal */}
      {drilldownProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {drilldownProduct.code} — {drilldownProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Drilldown list of {drilldownType === 'upcoming' ? 'upcoming expected' : 'shipped'} containers
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                onClick={() => setDrilldownProduct(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {drilldownData.length > 0 ? (
                <table className="ems-table w-full">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Container Index</th>
                      <th>Quantity / MT</th>
                      <th>Shipment Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownData.map((item: any) => {
                      const cId = item.contractId || item.contract?.id;
                      const cNumber = item.contractNumber || item.contract?.contractNumber;
                      const dateField = drilldownType === 'upcoming' ? item.expectedShipmentDate : item.actualShipmentDate;
                      return (
                        <tr key={item.id}>
                          <td className="font-semibold text-slate-700">{cNumber}</td>
                          <td>Container {item.containerIndex}</td>
                          <td>{item.quantityMt ?? '—'} MT</td>
                          <td>{dateField ? formatDate(dateField) : '—'}</td>
                          <td>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(item.status || item.containerStatus || '')}`}>
                              {statusLabel(item.status || item.containerStatus || '')}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={`/contracts/${cId}`}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              Open Contract
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="py-8 text-center text-slate-400 text-sm">No containers matches.</p>
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setDrilldownProduct(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
