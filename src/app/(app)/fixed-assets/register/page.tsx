
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { FixedAsset, Journal, Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { id } from 'date-fns/locale';

interface AssetDetail extends FixedAsset {
  accumulatedDepreciation: number;
  bookValue: number;
  ageInMonths: number;
  monthlyDepreciation: number;
}

export default function AssetRegisterPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const assetsUnsub = onSnapshot(query(collection(db, 'fixedAssets'), orderBy('acquisitionDate', 'desc')), (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        acquisitionDate: doc.data().acquisitionDate.toDate(),
      } as FixedAsset)));
    });

    const journalsUnsub = onSnapshot(query(collection(db, 'journals'), orderBy('date', 'asc')), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      } as Journal)));
    });

    const timer = setTimeout(() => setLoading(false), 1000); // Prevent flicker on fast loads

    return () => {
      assetsUnsub();
      journalsUnsub();
      clearTimeout(timer);
    };
  }, []);
  
  const assetDetails: AssetDetail[] = useMemo(() => {
    if (assets.length === 0) return [];
    
    return assets.map(asset => {
        const accumulatedDepreciation = journals.reduce((acc, journal) => {
            const entry = journal.entries.find(e => e.accountId === asset.accumulatedDepreciationAccountId);
            return acc + (entry ? entry.credit : 0);
        }, 0);

        const bookValue = asset.acquisitionCost - accumulatedDepreciation;
        const ageInMonths = differenceInMonths(new Date(), asset.acquisitionDate);
        const monthlyDepreciation = asset.acquisitionCost / (asset.usefulLife * 12);
        
        return {
            ...asset,
            accumulatedDepreciation,
            bookValue,
            ageInMonths,
            monthlyDepreciation,
        };
    });
  }, [assets, journals]);


  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl md:text-2xl font-headline font-bold">Register Aset Tetap</h2>
      <Card>
        <CardHeader>
          <CardTitle>Rincian Penyusutan dan Nilai Buku</CardTitle>
          <CardDescription>
            Menampilkan daftar semua aset tetap beserta akumulasi penyusutan dan nilai buku terkini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Aset</TableHead>
                  <TableHead className="text-right">Harga Perolehan</TableHead>
                  <TableHead className="text-right">Akum. Penyusutan</TableHead>
                  <TableHead className="text-right">Nilai Buku</TableHead>
                  <TableHead className="text-right">Penyusutan/Bulan</TableHead>
                  <TableHead className="text-center">Umur (Bulan)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : assetDetails.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada aset tetap yang dicatat.</TableCell></TableRow>
                ) : (
                  assetDetails.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        <p>{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{format(asset.acquisitionDate, "dd MMM yyyy", { locale: id })}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono">Rp {asset.acquisitionCost.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">Rp {asset.accumulatedDepreciation.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-bold font-mono">Rp {asset.bookValue.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-mono">Rp {asset.monthlyDepreciation.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-center">{asset.ageInMonths} / {asset.usefulLife * 12}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
