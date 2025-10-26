
'use client';

import type { Account, Journal } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CoaRowActions } from './coa-actions';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type AccountWithBalance = Account & { balance: number };

interface CoaTableProps {
  data: AccountWithBalance[];
}

export function CoaTable({ data }: CoaTableProps) {
    const [selectedAccount, setSelectedAccount] = useState<AccountWithBalance | null>(null);
    const [transactions, setTransactions] = useState<Journal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedAccount) return;
        
        setLoading(true);
        const q = query(
            collection(db, 'journals'),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allJournals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            } as Journal));

            const relatedJournals = allJournals.filter(j => 
                j.entries.some(e => e.accountId === selectedAccount.id)
            );

            setTransactions(relatedJournals);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedAccount]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedAccount(null);
            setTransactions([]);
        }
    };

    const getEntryForAccount = (journal: Journal) => {
        return journal.entries.find(e => e.accountId === selectedAccount?.id);
    }

  return (
    <Dialog onOpenChange={handleOpenChange}>
        <div className="w-full overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Kode Akun</TableHead>
                <TableHead>Nama Akun</TableHead>
                <TableHead>Tipe Akun</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {data.map((account) => (
                <TableRow key={account.id}>
                <TableCell className="font-mono">{account.code}</TableCell>
                <TableCell className="font-medium">
                    <DialogTrigger asChild>
                        <Button variant="link" className="p-0 h-auto font-medium text-left" onClick={() => setSelectedAccount(account)}>
                            {account.name}
                        </Button>
                    </DialogTrigger>
                </TableCell>
                <TableCell>
                    <Badge variant="secondary">{account.type}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                    Rp {account.balance.toLocaleString('id-ID')}
                </TableCell>
                <TableCell className="text-right">
                    <CoaRowActions account={account} />
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
        </div>
        
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Riwayat Transaksi: {selectedAccount?.name}</DialogTitle>
                <DialogDescription>
                    Menampilkan semua jurnal yang memengaruhi akun ini. Saldo saat ini: Rp {selectedAccount?.balance.toLocaleString('id-ID')}
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">Akun ini belum memiliki riwayat transaksi.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Kredit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => {
                                const entry = getEntryForAccount(tx);
                                return (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(tx.date, 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-right font-mono">{entry?.debit ? entry.debit.toLocaleString('id-ID') : '-'}</TableCell>
                                        <TableCell className="text-right font-mono">{entry?.credit ? entry.credit.toLocaleString('id-ID') : '-'}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </DialogContent>
    </Dialog>
  );
}
