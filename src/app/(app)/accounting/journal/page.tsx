
'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Trash2, Save, Loader2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import type { Account, NewJournal, JournalEntry as JournalEntryType } from '@/lib/types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addJournalEntry } from './actions';

type EntryRow = {
  id: number;
  accountId: string;
  debit: number;
  credit: number;
};

const INITIAL_ROWS = [
  { id: 1, accountId: '', debit: 0, credit: 0 },
  { id: 2, accountId: '', debit: 0, credit: 0 },
];

export default function GeneralJournalPage() {
  const [entries, setEntries] = useState<EntryRow[]>(INITIAL_ROWS);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nextId, setNextId] = useState(3);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [refNumber, setRefNumber] = useState('');

  useEffect(() => {
    setDate(new Date());
    const unsub = onSnapshot(collection(db, 'coa'), (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)).sort((a, b) => a.code.localeCompare(b.code)));
    });
    return () => unsub();
  }, []);

  const handleEntryChange = (id: number, field: keyof EntryRow, value: string | number) => {
    setEntries(prevEntries => 
      prevEntries.map(entry => {
        if (entry.id === id) {
          if (field === 'debit' || field === 'credit') {
            const numValue = Number(value) || 0;
            if (field === 'debit' && numValue > 0) return { ...entry, debit: numValue, credit: 0 };
            if (field === 'credit' && numValue > 0) return { ...entry, credit: numValue, debit: 0 };
            return { ...entry, [field]: numValue };
          }
          return { ...entry, [field]: value };
        }
        return entry;
      })
    );
  };

  const addRow = () => {
    setEntries(prev => [...prev, { id: nextId, accountId: '', debit: 0, credit: 0 }]);
    setNextId(prev => prev + 1);
  };

  const removeRow = (id: number) => {
    if (entries.length > 2) {
      setEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };
  
  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
    return {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit && totalDebit !== 0,
    };
  }, [entries]);

  const resetForm = () => {
    setDate(new Date());
    setDescription('');
    setRefNumber('');
    setEntries(INITIAL_ROWS);
    setNextId(3);
  }

  const handleSave = () => {
    if (!isBalanced) {
        toast({ title: "Jurnal tidak seimbang!", variant: "destructive" });
        return;
    }
    if (!date || !description) {
        toast({ title: "Data tidak lengkap", description: "Tanggal dan deskripsi harus diisi.", variant: "destructive"});
        return;
    }

    const journalEntries: JournalEntryType[] = entries
      .filter(e => e.accountId && (e.debit > 0 || e.credit > 0))
      .map(e => {
        const account = accounts.find(a => a.id === e.accountId);
        return {
          accountId: e.accountId,
          accountName: account?.name || 'Unknown',
          debit: e.debit,
          credit: e.credit,
        };
      });

    if (journalEntries.length < 2) {
      toast({ title: "Entri tidak valid", description: "Minimal harus ada dua baris entri yang valid.", variant: "destructive"});
      return;
    }

    const newJournal: NewJournal = {
      date,
      description,
      refNumber,
      entries: journalEntries,
      total: totalDebit,
    };
    
    startTransition(async () => {
      const result = await addJournalEntry(newJournal);
      if (result.error) {
        toast({ title: "Gagal menyimpan jurnal", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Jurnal berhasil disimpan!" });
        resetForm();
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Jurnal Umum</h1>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Buat Entri Jurnal Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="journal-date">Tanggal</Label>
              <DatePicker date={date} setDate={setDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-number">No. Referensi</Label>
              <Input id="journal-number" placeholder="Otomatis jika kosong" value={refNumber} onChange={e => setRefNumber(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" placeholder="Deskripsi transaksi jurnal" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Akun</TableHead>
                  <TableHead className="min-w-[150px]">Debit</TableHead>
                  <TableHead className="min-w-[150px]">Kredit</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Select value={entry.accountId} onValueChange={(value) => handleEntryChange(entry.id, 'accountId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih akun" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={entry.debit === 0 ? '' : entry.debit}
                        onChange={(e) => handleEntryChange(entry.id, 'debit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={entry.credit === 0 ? '' : entry.credit}
                        onChange={(e) => handleEntryChange(entry.id, 'credit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeRow(entry.id)} disabled={entries.length <= 2}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
           <Button variant="outline" className="w-full" onClick={addRow}>
            <PlusCircle className="mr-2 h-4 w-4" /> Tambah Baris
          </Button>
          <div className="flex justify-between items-center font-bold text-lg pt-4 border-t">
              <div className="flex items-center gap-2">
                <span>Total</span>
                <Badge variant={isBalanced ? 'secondary' : 'destructive'}>
                  {isBalanced ? 'Seimbang' : 'Tidak Seimbang'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 min-w-[200px] sm:min-w-[300px] font-mono text-base">
                <div>Rp {totalDebit.toLocaleString('id-ID')}</div>
                <div>Rp {totalCredit.toLocaleString('id-ID')}</div>
              </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={!isBalanced || isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Jurnal
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Add this to date-picker component to accept date and setDate props
declare module '@/components/ui/date-picker' {
    interface DatePickerProps {
        date?: Date;
        setDate?: (date?: Date) => void;
    }
}
