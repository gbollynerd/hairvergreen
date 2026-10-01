'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/components/store/store-provider';
import { Dialog } from '@/components/ui/dialog';
import { ProductView, type AttrMap } from './product-view';
import type { ProductFull } from '@/lib/types';
import { track } from '@/lib/analytics-client';

export function QuickView() {
  const { quickView, setQuickView } = useStore();
  const [data, setData] = useState<{ product: ProductFull; attrs: AttrMap } | null>(null);
  useEffect(() => {
    if (!quickView) { setData(null); return; }
    let live = true;
    fetch(`/api/products/${encodeURIComponent(quickView)}`).then((r) => r.json()).then((d) => { if (live && d.product) { setData(d); track('quick_view', { product_id: d.product.id }); } });
    return () => { live = false; };
  }, [quickView]);
  return (
    <Dialog open={!!quickView} onClose={() => setQuickView(null)} label="Quick view" variant="modal" className="!max-w-5xl p-5 md:p-8">
      {data ? <ProductView product={data.product} attrs={data.attrs} compact /> : (
        <div className="grid gap-8 md:grid-cols-2"><div className="skeleton aspect-[4/5]" /><div className="space-y-4"><div className="skeleton h-10 w-3/4" /><div className="skeleton h-6 w-1/3" /><div className="skeleton h-24" /></div></div>
      )}
    </Dialog>
  );
}
