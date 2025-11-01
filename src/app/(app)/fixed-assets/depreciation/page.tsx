
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { runDepreciation } from '../actions';
import type { FixedAsset, DepreciationRun } from '@/lib/types';
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

export default function AssetDepreciationPage() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [depreciationHistory, setDepreciationHistory] = useState<DepreciationRun[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'depreciationRuns'), (snapshot) => {
            setDepreciationHistory(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            } as DepreciationRun)).sort((a,b) => b.date.getTime() - a.date.getTime()));
        });
        return () => unsub();
    }, []);

    const handleRunDepreciation = () => {
        const isAlreadyRun = depreciationHistory.some(h => h.year === year && h.month === month);
        if (isAlreadyRun) {
            toast({
                title: 'Periode Sudah Dijalankan',
                description: `Penyusutan untuk ${getMonthName(month)} ${year} sudah pernah dijalankan sebelumnya.`,
                variant: 'destructive'
            });
            return;
        }

        startTransition(async () => {
            const result = await runDepreciation(month, year);
            if (result.error) {
                toast({ title: 'Gagal Menjalankan Penyusutan', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Penyusutan Berhasil!', description: `Jurnal penyusutan untuk ${getMonthName(month)} ${year} telah berhasil dibuat.` });
            }
        });
    };
    
    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });
    }

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-xl md:text-2xl font-headline font-bold">Jalankan Penyusutan Aset</h2>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Proses Penyusutan Bulanan</CardTitle>
                    <CardDescription>
                        Fitur ini akan menghitung dan membuat jurnal penyusutan untuk semua aset tetap yang Anda miliki pada periode yang dipilih.
                        <br/><strong className="text-destructive">Peringatan:</strong> Pastikan Anda belum pernah menjalankan proses ini untuk periode yang sama.
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
                     <Button onClick={handleRunDepreciation} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                        Jalankan Proses Penyusutan
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Penyusutan</CardTitle>
                    <CardDescription>Daftar proses penyusutan yang telah dijalankan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Periode</TableHead>
                                <TableHead>Tanggal Proses</TableHead>
                                <TableHead className="text-right">Total Penyusutan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {depreciationHistory.map(h => (
                                <TableRow key={h.id}>
                                    <TableCell className="font-medium">{getMonthName(h.month)} {h.year}</TableCell>
                                    <TableCell>{format(h.date, "dd MMM yyyy, HH:mm", { locale: id })}</TableCell>
                                    <TableCell className="text-right font-mono">Rp {h.totalDepreciation.toLocaleString('id-ID')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
