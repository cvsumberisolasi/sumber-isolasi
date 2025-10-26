
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import type { ProductCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryActions } from '@/components/products/category-actions';
import { CategoryTable } from '@/components/products/category-table';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'productCategories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, snapshot => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">
          Kategori Produk
        </h2>
        <div className="w-full sm:w-auto">
         <CategoryActions />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Daftar Kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryTable data={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
