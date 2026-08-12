'use client';

import { ProductionChrome } from '@/components/production/production-shell';
import { ProductionKeepAlive } from '@/components/production/production-keep-alive';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductionChrome>
      <ProductionKeepAlive>{children}</ProductionKeepAlive>
    </ProductionChrome>
  );
}
