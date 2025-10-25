
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import type { Product } from '@/lib/types';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductTable } from '@/components/products/product-table';
import { ProductActions } from '@/components/products/product-actions';
import { Loader2 } from 'lucide-react';

export default function ProductsListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          stock: data.stock,
          category: data.category,
          cost: data.cost,
          units: data.units || [],
          baseUnit: data.baseUnit,
        } as Product;
      });
      setProducts(productList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
