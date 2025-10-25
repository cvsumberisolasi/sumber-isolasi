
'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkOrder, BillOfMaterial, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ArrowLeft, Save, Eye, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addWorkOrder, updateWorkOrderStatus } from '../actions';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
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

export default function WorkOrderPage() {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);

  useEffect(() => {
    const woUnsub = onSnapshot(query(collection(db, "workOrders"), orderBy("date", "desc")), (snapshot) => {
      setWorkOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate(), startDate: doc.data().startDate.toDate(), endDate: doc.data().endDate.toDate() } as WorkOrder)));
      setLoading(false);
    });

    return () => woUnsub();
  }, []);

  const handleViewDetail = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setView('detail');
  }
  
  const handleBackToList = () => {
    setSelectedWO(null);
    setView('list');
  }

  if (view === 'new') {
    return <NewWorkOrderForm onBack={handleBackToList} />;
  }
  
  if (view === 'detail' && selectedWO) {
    return <WorkOrderDetail woId={selectedWO.id} onBack={handleBackToList} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Perintah Produksi (Work Order)</h1>
        <Button onClick={() => setView('new')}>
          <Plus className="mr-2 h-4 w-4" /> Buat Perintah Baru
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Perintah Produksi</CardTitle>
          <CardDescription>Dokumen internal untuk memulai dan melacak proses produksi.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>No. WO</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : workOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada perintah produksi.</TableCell></TableRow>
              ) : (
                workOrders.map(wo => (
                  <TableRow key={wo.id}>
                    <TableCell>{format(wo.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{wo.id}</TableCell>
                    <TableCell className="font-medium">{wo.finishedGoodName}</TableCell>
                    <TableCell>{wo.quantityToProduce}</TableCell>
                    <TableCell><WOStatusBadge status={wo.status} /></TableCell>
                     <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetail(wo)}>
                            <Eye className="mr-2 h-4 w-4"/> Detail
                        </Button>
                    </TableCell>
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


function NewWorkOrderForm({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState<Date|undefined>(new Date());
  const [endDate, setEndDate] = useState<Date|undefined>();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const bomsUnsub = onSnapshot(collection(db, "billOfMaterials"), (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BillOfMaterial)));
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setEndDate(tomorrow);

    return () => bomsUnsub();
  }, []);

  const selectedBom = useMemo(() => boms.find(b => b.id === selectedBomId), [boms, selectedBomId]);

  useEffect(() => {
    if (selectedBom) {
        setQuantity(selectedBom.quantityProduced || 1);
    } else {
        setQuantity(1);
    }
  }, [selectedBom]);

  const handleSave = () => {
    if (!selectedBom || !startDate || !endDate || quantity <= 0) {
        toast({ title: 'Data tidak lengkap', description: 'Mohon isi semua field yang diperlukan.', variant: 'destructive'});
        return;
    }

    const newWO: NewWorkOrder = {
        date: new Date(),
        finishedGoodId: selectedBom.productId,
        finishedGoodName: selectedBom.productName,
        quantityToProduce: quantity,
        bomId: selectedBom.id,
        status: 'Belum Diproses',
        notes,
        startDate,
        endDate,
    };

    startTransition(async () => {
        const result = await addWorkOrder(newWO);
        if (result.error) {
            toast({ title: 'Gagal Menyimpan WO', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Berhasil', description: `Work Order untuk ${newWO.finishedGoodName} telah dibuat.`});
            onBack();
        }
    });
  }

  return (
    <div className="flex flex-col gap-6">
       <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Buat Perintah Produksi Baru</h1>
      <Card>
        <CardHeader>
            <CardTitle>Detail Perintah Produksi</CardTitle>
            <CardDescription>Pilih produk yang akan diproduksi dan tentukan jumlahnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Produk yang akan Dibuat</Label>
                    <Select value={selectedBomId} onValueChange={setSelectedBomId}>
                        <SelectTrigger><SelectValue placeholder="Pilih produk dari BOM..." /></SelectTrigger>
                        <SelectContent>
                            {boms.map(bom => (
                                <SelectItem key={bom.id} value={bom.id}>{bom.productName} (menghasilkan x{bom.quantityProduced})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Jumlah Produksi</Label>
                    <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} onFocus={(e) => e.target.select()}/>
                    <p className="text-xs text-muted-foreground">Jumlah barang jadi yang ingin dihasilkan.</p>
                </div>
            </div>
            {selectedBom && (
                <Card className="bg-muted/50">
                    <CardHeader><CardTitle className="text-base">Kebutuhan Bahan Baku (Estimasi)</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>Bahan</TableHead><TableHead className="text-right">Kebutuhan</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {selectedBom.items.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell className="text-right">{item.quantity * (quantity / selectedBom.quantityProduced)} unit</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            )}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tanggal Mulai</Label>
                    <DatePicker date={startDate} setDate={setStartDate}/>
                </div>
                <div className="space-y-2">
                    <Label>Rencana Selesai</Label>
                    <DatePicker date={endDate} setDate={setEndDate}/>
                </div>
            </div>
            <div className="space-y-2">
                <Label>Catatan Tambahan</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruksi khusus atau detail produksi..."/>
            </div>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending || !selectedBom}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                <Save className="mr-2 h-4 w-4"/> Simpan Perintah
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function WorkOrderDetail({ woId, onBack }: { woId: string, onBack: () => void }) {
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "workOrders", woId), (doc) => {
            if (doc.exists()) {
                 setWo({ id: doc.id, ...doc.data(), date: doc.data().date.toDate(), startDate: doc.data().startDate.toDate(), endDate: doc.data().endDate.toDate() } as WorkOrder);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [woId]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (!wo) {
        return <div>Work Order tidak ditemukan.</div>;
    }

    return (
         <div className="flex flex-col gap-6">
            <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar
            </Button>
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Detail WO #{wo.id}</h1>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{wo.finishedGoodName} (x{wo.quantityToProduce})</CardTitle>
                            <CardDescription>
                                Dibuat pada: {format(wo.date, "dd MMMM yyyy", { locale: id })}
                            </CardDescription>
                        </div>
                        <WOStatusBadge status={wo.status}/>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p><strong>Rencana Pengerjaan:</strong> {format(wo.startDate, "dd MMM yyyy")} - {format(wo.endDate, "dd MMM yyyy")}</p>
                    {wo.notes && <p><strong>Catatan:</strong> {wo.notes}</p>}
                </CardContent>
                <CardFooter>
                    <WOActions wo={wo} />
                </CardFooter>
            </Card>
         </div>
    );
}

function WOActions({ wo }: { wo: WorkOrder }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleChangeStatus = (status: WorkOrder['status']) => {
        startTransition(async () => {
            const result = await updateWorkOrderStatus(wo.id, status);
            if (result.error) {
                toast({ title: 'Gagal Memperbarui Status', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Status Berhasil Diperbarui', description: `Status WO #${wo.id} diubah menjadi "${status}".` });
            }
        });
    }

    if (wo.status === 'Belum Diproses') {
        return (
             <Button onClick={() => handleChangeStatus('Dalam Pengerjaan')} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                Mulai Pengerjaan
            </Button>
        );
    }
    
    if (wo.status === 'Dalam Pengerjaan') {
        return (
            <div className="flex gap-2">
                <Button asChild>
                    <Link href="/production/worksheet"><CheckCircle className="mr-2 h-4 w-4"/> Selesaikan di Lembar Kerja</Link>
                </Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isPending}>
                            <XCircle className="mr-2 h-4 w-4"/> Batalkan
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Batalkan Perintah Produksi?</AlertDialogTitle>
                            <AlertDialogDescription>Tindakan ini akan mengubah status WO menjadi "Dibatalkan".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleChangeStatus('Dibatalkan')} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Ya, Batalkan'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    return null;
}


function WOStatusBadge({ status }: { status: WorkOrder['status'] }) {
    const variants = {
        'Belum Diproses': 'secondary',
        'Dalam Pengerjaan': 'default',
        'Selesai': 'outline',
        'Dibatalkan': 'destructive'
    } as const;
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
}
