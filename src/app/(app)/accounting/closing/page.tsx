
'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, BookLock, Trash2, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { performPeriodClosing, deletePeriodClosing } from './actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DocumentData } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';

type PeriodClosing = {
    id: string;
    year: number;
    month: number;
    closedAt: any;
}

const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });
}

export default function PeriodClosingPage() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const [closingHistory, setClosingHistory] = useState<PeriodClosing[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
      const today = new Date();
      if (today.getMonth() === 0) {
        setMonth(12);
        setYear(today.getFullYear() - 1);
      } else {
        setMonth(today.getMonth());
      }
      
      const q = query(collection(db, 'periodClosings'), orderBy('year', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
          const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeriodClosing));
          // Sort by month client-side
          history.sort((a, b) => b.month - a.month);
          setClosingHistory(history);
          setLoadingHistory(false);
      });
      
      return () => unsub();
    }, []);

    const handleClosing = () => {
        if (month === 0) {
            toast({ title: 'Bulan tidak valid', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await performPeriodClosing({ year, month });
            if (result.error) {
                toast({ title: 'Gagal Melakukan Tutup Buku', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Tutup Buku Berhasil!', description: `Jurnal penutup untuk periode ${getMonthName(month)} ${year} telah berhasil dibuat.` });
                if (result.extraMessage) {
                    toast({ title: 'Jurnal Pembalik Dibuat', description: result.extraMessage });
                }
            }
        });
    };
    
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Tutup Buku Periode</h1>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Proses Tutup Buku & Jurnal Balik</CardTitle>
                    <CardDescription>
                        Fitur ini akan membuat jurnal penutup untuk semua akun pendapatan dan beban, mentransfer laba bersih ke Laba Ditahan, dan secara otomatis membuat jurnal pembalik untuk periode berikutnya.
                        <br/><strong className="text-destructive">Peringatan:</strong> Proses ini tidak dapat diurungkan. Pastikan semua transaksi pada periode tersebut sudah final.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                         <div className="space-y-2">
                            <Label htmlFor="month">Bulan</Label>
                            <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                                <SelectTrigger id="month"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="year">Tahun</Label>
                             <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
                                <SelectTrigger id="year"><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={month === 0}>
                                <BookLock className="mr-2 h-4 w-4" /> Mulai Proses Tutup Buku
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Tutup Buku</AlertDialogTitle>
                            <AlertDialogDescription>
                                Anda akan melakukan tutup buku untuk periode <strong>{getMonthName(month)} {year}</strong>.
                                Tindakan ini bersifat permanen dan akan membuat jurnal penutup serta jurnal pembalik. Pastikan semua data sudah benar. Lanjutkan?
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClosing} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Ya, Lanjutkan'}
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Riwayat Tutup Buku</CardTitle>
                    <CardDescription>Daftar periode yang telah ditutup bukunya.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Periode</TableHead>
                                <TableHead>Tanggal Tutup Buku</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="animate-spin"/></TableCell></TableRow>
                            ) : closingHistory.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Belum ada riwayat tutup buku.</TableCell></TableRow>
                            ) : (
                                closingHistory.map(item => <ClosingHistoryRow key={item.id} item={item} />)
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}


function ClosingHistoryRow({ item }: { item: PeriodClosing }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deletePeriodClosing(item.id);
            if (result.error) {
                toast({ title: 'Gagal Membatalkan', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Berhasil', description: `Tutup buku untuk periode ${getMonthName(item.month)} ${item.year} telah dibatalkan.` });
            }
        });
    }

    return (
        <TableRow>
            <TableCell className="font-medium">{getMonthName(item.month)} {item.year}</TableCell>
            <TableCell>{format(item.closedAt.toDate(), "dd MMMM yyyy, HH:mm", { locale: id })}</TableCell>
            <TableCell className="text-right">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}><Trash2 className="mr-2 h-4 w-4"/> Batalkan</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Batalkan Tutup Buku?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Anda akan membatalkan tutup buku periode <strong>{getMonthName(item.month)} {item.year}</strong>.
                                Semua jurnal penutup dan pembalik yang terkait akan dihapus secara permanen. Lanjutkan?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: "destructive" }))} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Ya, Batalkan'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TableCell>
        </TableRow>
    )
}
