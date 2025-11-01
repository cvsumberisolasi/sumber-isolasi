
'use client';

import React, { useState, useEffect } from 'react';
import type { FixedAsset, Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AssetFormDialog } from '@/components/fixed-assets/asset-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function AssetListPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const assetsUnsub = onSnapshot(query(collection(db, 'fixedAssets'), orderBy('acquisitionDate', 'desc')), (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        acquisitionDate: doc.data().acquisitionDate.toDate(),
      } as FixedAsset)));
      setLoading(false);
    });

    const fetchAccounts = async () => {
        const assetAccountTypes = ['Aset Tetap', 'Akumulasi Penyusutan', 'Beban Operasional', 'Kas & Bank'];
        const q = query(collection(db, 'coa'), where('type', 'in', assetAccountTypes));
        const snapshot = await getDocs(q);
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    }
    fetchAccounts();

    return () => assetsUnsub();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Daftar Aset Tetap</h2>
        <AssetFormDialog accounts={accounts}>
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Tambah Aset Baru
            </Button>
        </AssetFormDialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Aset</CardTitle>
          <CardDescription>Semua aset tetap yang dimiliki perusahaan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Aset</TableHead>
                <TableHead>Tgl Perolehan</TableHead>
                <TableHead className="text-right">Harga Perolehan</TableHead>
                <TableHead className="text-right">Masa Manfaat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : assets.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Belum ada aset tetap yang dicatat.</TableCell></TableRow>
              ) : (
                assets.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{format(asset.acquisitionDate, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="text-right font-mono">Rp {asset.acquisitionCost.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{asset.usefulLife} tahun</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
