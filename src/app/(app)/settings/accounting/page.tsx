
import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccountingSettings } from './actions';
import { AccountingSettingsForm } from './accounting-settings-form';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account } from '@/lib/types';

async function getAccounts(): Promise<Account[]> {
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
  return accountList;
}

export default async function AccountingSettingsPage() {
  const settings = await getAccountingSettings();
  const accounts = await getAccounts();

  return (
    <div className="flex flex-col gap-6">
       <h1 className="text-2xl md:text-3xl font-headline font-bold">Pengaturan Akuntansi</h1>
        <Card>
        <CardHeader>
            <CardTitle className="font-headline">Pemetaan Akun Otomatis</CardTitle>
            <CardDescription>
            Pilih akun default yang akan digunakan untuk pembuatan jurnal otomatis dari transaksi.
            Pastikan semua akun yang diperlukan sudah dibuat di Bagan Akun (COA).
            </CardDescription>
        </CardHeader>
        <CardContent>
            <AccountingSettingsForm initialData={settings} accounts={accounts} />
        </CardContent>
        </Card>
    </div>
  );
}
