
'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccountingSettings, AccountingSettings } from './actions';
import { AccountingSettingsForm } from './accounting-settings-form';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountingSettingsPage() {
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        const settingsData = await getAccountingSettings();
        setSettings(settingsData);

        const accountsCol = collection(db, 'coa');
        const accountSnapshot = await getDocs(query(accountsCol, orderBy('code')));
        const accountList = accountSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                code: data.code,
                name: data.name,
                type: data.type,
            } as Account;
        });
        setAccounts(accountList);
        setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
    <CardHeader>
        <CardTitle className="font-headline">Pemetaan Akun Otomatis</CardTitle>
        <CardDescription>
        Pilih akun default yang akan digunakan untuk pembuatan jurnal otomatis dari transaksi.
        Pastikan semua akun yang diperlukan sudah dibuat di Bagan Akun (COA).
        </CardDescription>
    </CardHeader>
    <CardContent>
        <AccountingSettingsForm initialData={settings || {}} accounts={accounts} />
    </CardContent>
    </Card>
  );
}
