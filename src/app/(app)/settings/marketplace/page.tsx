
'use client';

import React, { useState, useEffect } from 'react';
import type { MarketplaceStore } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MarketplaceStoreTable } from '@/components/settings/marketplace-table';
import { MarketplaceActions } from '@/components/settings/marketplace-actions';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function MarketplaceSettingsPage() {
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'marketplaceStores'), orderBy('marketplace'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStores(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MarketplaceStore)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Daftar Toko</CardTitle>
          <CardDescription>
          Kelola daftar toko Anda di berbagai marketplace untuk integrasi data.
        </CardDescription>
        <div className="pt-4">
            <MarketplaceActions />
        </div>
      </CardHeader>
      <CardContent>
        <MarketplaceStoreTable data={stores} />
      </CardContent>
    </Card>
  );
}
