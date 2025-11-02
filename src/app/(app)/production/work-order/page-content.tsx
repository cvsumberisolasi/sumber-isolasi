
'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkOrder, BillOfMaterial, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, Plus, ArrowLeft, Save, Eye, CheckCircle, XCircle, PlayCircle, Play } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addWorkOrder, updateMultipleWorkOrderStatus, updateWorkOrderStatus } from '../actions';
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function WorkOrderPageContent() {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const { toast } = useToast();
  const [isBulkPending, startBulkTransition] = useTransition();

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
  
  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allDraftIds = workOrders.filter(wo => wo.status === 'Belum Diproses').map(wo => wo.id);
      setSelectedRows(allDraftIds);
    } else {
      setSelectedRows([]);
    }
  }

  const handleBulkStart = () => {
    startBulkTransition(async () => {
        const result = await updateMultipleWorkOrderStatus(selectedRows, 'Dalam Pengerjaan');
        if (result.error) {
            toast({ title: 'Gagal Memulai WO', description: result.error, variant: 'destructive'});
        } else {
            toast({ title: 'Berhasil', description: `${selectedRows.length} WO telah dimulai.`});
            setSelectedRows([]);
        }
    });
  }

  if (view === 'new') {
    return <NewWorkOrderForm onBack={handleBackToList} />;
  }
  
  if (view === 'detail' && selectedWO) {
    return <WorkOrderDetail woId={selectedWO.id} onBack={handleBackToList} />
  }
  
  const selectableDraftsCount = workOrders.filter(wo => wo.status === 'Belum Diproses').length;


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-headline font-bold">Perintah Produksi (Work Order)</h2>
          <p className="text-muted-foreground text-sm">Dokumen internal untuk memulai dan melacak proses produksi.</p>
        </div>
        <Button onClick={() => setView('new')}>
          <Plus className="mr-2 h-4 w-4" /> Buat Perintah Baru
        </Button>
      </div>
       {selectedRows.length > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="font-semibold text-sm">{selectedRows.length} perintah produksi dipilih.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button>
                    <Play className="mr-2 h-4 w-4" /> Mulai Pengerjaan Terpilih
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Mulai {selectedRows.length} Perintah Produksi?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Status perintah produksi yang dipilih akan diubah menjadi "Dalam Pengerjaan". Lanjutkan?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkStart} disabled={isBulkPending}>
                         {isBulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Ya, Mulai Sekarang'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Perintah Produksi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                   <Checkbox 
                        checked={selectableDraftsCount > 0 && selectedRows.length === selectableDraftsCount}
                        onCheckedChange={handleSelectAll}
                        aria-label="Pilih semua yang bisa dipilih"
                    />
                </TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : workOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Belum ada perintah produksi.</TableCell></TableRow>
              ) : (
                workOrders.map(wo => (
                  <TableRow key={wo.id} className={cn(selectedRows.includes(wo.id) && 'bg-muted/50')}>
                    <TableCell>
                        <Checkbox 
                            checked={selectedRows.includes(wo.id)}
                            onCheckedChange={() => handleSelectRow(wo.id)}
                            disabled={wo.status !== 'Belum Diproses'}
                            aria-label={`Pilih WO ${wo.id}`}
                        />
                    </TableCell>
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
  const [productionCycles, setProductionCycles] = useState(1);
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

  const totalQuantityToProduce = useMemo(() => {
    if (!selectedBom) return 0;
    return (selectedBom.quantityProduced || 1) * productionCycles;
  }, [selectedBom, productionCycles]);

  useEffect(() => {
    if (selectedBom) {
        setProductionCycles(1);
    }
  }, [selectedBom]);

  const handleSave = () => {
    if (!selectedBom || !startDate || !endDate || totalQuantityToProduce <= 0) {
        toast({ title: 'Data tidak lengkap', description: 'Mohon isi semua field yang diperlukan.', variant: 'destructive'});
        return;
    }

    const newWO: NewWorkOrder = {
        date: new Date(),
        finishedGoodId: selectedBom.productId,
        finishedGoodName: selectedBom.productName,
        quantityToProduce: totalQuantityToProduce,
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="productionCycles">Jumlah Siklus Produksi</Label>
                        <Input id="productionCycles" type="number" value={productionCycles} onChange={e => setProductionCycles(Number(e.target.value))} min={1} onFocus={(e) => e.target.select()}/>
                    </div>
                    <div className="space-y-2">
                        <Label>Total Jumlah Produksi</Label>
                        <Input type="number" value={totalQuantityToProduce} disabled className="font-bold"/>
                    </div>
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
                                        <TableCell className="text-right">{item.quantity * productionCycles} {item.unit}</TableCell>
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
    const [bom, setBom] = useState<BillOfMaterial | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const woSnap = await getDoc(doc(db, "workOrders", woId));
                if (woSnap.exists()) {
                    const workOrder = { id: woSnap.id, ...woSnap.data() } as WorkOrder;
                    workOrder.date = (workOrder.date as any).toDate();
                    workOrder.startDate = (workOrder.startDate as any).toDate();
                    workOrder.endDate = (workOrder.endDate as any).toDate();
                    setWo(workOrder);

                    const bomSnap = await getDoc(doc(db, "billOfMaterials", workOrder.bomId));
                    if (bomSnap.exists()) {
                        setBom({ id: bomSnap.id, ...bomSnap.data() } as BillOfMaterial);
                    }
                    
                    const productsSnap = await getDocs(collection(db, "products"));
                    setProducts(productsSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Product)));
                }
            } catch (e) {
                console.error("Error fetching WO details: ", e);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [woId]);
    
    const { totalProductionCost } = useMemo(() => {
        if (!wo || !bom || products.length === 0) {
            return { totalProductionCost: 0 };
        }
        
        const productionCycles = wo.quantityToProduce / bom.quantityProduced;

        const totalRawMaterialCost = bom.items.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            const cost = product?.cost || 0;
            return sum + (cost * item.quantity * productionCycles);
        }, 0);

        const totalAdditionalCost = bom.additionalCosts?.reduce((sum, cost) => {
            return sum + (cost.amount * productionCycles);
        }, 0) || 0;

        return {
            totalProductionCost: totalRawMaterialCost + totalAdditionalCost
        };
    }, [wo, bom, products]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (!wo) {
        return <div>Work Order tidak ditemukan.</div>;
    }

    const productionCycles = bom ? wo.quantityToProduce / bom.quantityProduced : 0;

    return (
         <div className="flex flex-col gap-6">
            <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar
            </Button>
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Detail WO #{wo.id}</h1>

            <div className="grid md:grid-cols-2 gap-6">
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

                <Card>
                    <CardHeader>
                        <CardTitle>Estimasi Biaya Produksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Komponen Biaya</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bom?.items.map(item => {
                                     const product = products.find(p => p.id === item.productId);
                                     const itemCost = (product?.cost || 0) * item.quantity * productionCycles;
                                     return (
                                        <TableRow key={item.productId}>
                                            <TableCell className="pl-4">{item.productName}</TableCell>
                                            <TableCell className="text-right font-mono">Rp {itemCost.toLocaleString('id-ID')}</TableCell>
                                        </TableRow>
                                     )
                                })}
                                 {bom?.additionalCosts?.map((cost, i) => {
                                     const itemCost = cost.amount * productionCycles;
                                      return (
                                        <TableRow key={cost.accountId + i}>
                                            <TableCell className="pl-4">{cost.accountName}</TableCell>
                                            <TableCell className="text-right font-mono">Rp {itemCost.toLocaleString('id-ID')}</TableCell>
                                        </TableRow>
                                      )
                                 })}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold text-base">
                                    <TableCell>Total Estimasi Biaya Produksi</TableCell>
                                    <TableCell className="text-right font-mono">Rp {totalProductionCost.toLocaleString('id-ID')}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>
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
                            <AlertDialogAction onClick={() => handleChangeStatus('Dibatalkan')} disabled={isPending} className={cn(buttonVariants({ variant: "destructive" }))}>
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
