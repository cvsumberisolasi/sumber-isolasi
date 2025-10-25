
'use client';

import type { Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductTable } from '@/components/products/product-table';
import { ProductActions } from '@/components/products/product-actions';

export function ProductsClient({ products }: { products: Product[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Daftar Produk</h2>
        <ProductActions hasProducts={products.length > 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Semua Produk</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductTable data={products} />
        </CardContent>
      </Card>
    </div>
  );
}
