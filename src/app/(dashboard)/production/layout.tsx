'use client';

import { ProductionChrome } from '@/components/production/production-shell';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return <ProductionChrome>{children}</ProductionChrome>;
}
