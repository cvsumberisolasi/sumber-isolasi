
'use client';

import React, { useState, useEffect } from 'react';
import type { Warehouse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WarehouseTable } from '@/components/stock/warehouse-table';
import { WarehouseActions } from '@/components/stock/warehouse-actions';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'warehouses'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Warehouse)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">
          Manajemen Gudang
        </h2>
        <div className="w-full sm:w-auto">
          <WarehouseActions />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Daftar Gudang</CardTitle>
        </CardHeader>
        <CardContent>
          <WarehouseTable data={warehouses} />
        </CardContent>
      </Card>
    </div>
  );
}
