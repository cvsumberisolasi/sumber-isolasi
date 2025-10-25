
'use client';

import { useState, useEffect } from 'react';
import { EstimationForm } from "@/components/stock-estimation/estimation-form";
import type { Product, Transaction } from '@/lib/types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function StockEstimationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const productsUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const transactionsUnsub = onSnapshot(collection(db, "transactions"), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date.toDate()
      } as Transaction)));
    });

    return () => {
      productsUnsub();
      transactionsUnsub();
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-headline font-bold">Estimasi Jumlah Stok (AI)</h1>
      <p className="text-muted-foreground">
        Gunakan tool AI untuk mendapatkan saran dan memprediksi kuantitas stok optimal untuk suatu produk.
        Tool ini akan mempertimbangkan berbagai faktor historis, tren penjualan, dan variabel lain yang relevan.
      </p>
      <EstimationForm products={products} transactions={transactions} />
    </div>
  );
}
