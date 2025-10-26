
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkOrder, BillOfMaterial, Product, NewProductionCompletion, AdditionalCostItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save, Workflow, Check } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { completeProduction, completeMultipleProductions } from '../actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

export default function WorksheetPageContent() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isBulkPending, startBulkTransition] = useTransition();
  const { toast } = useToast();


  useEffect(() => {
    const q = query(collection(db, "workOrders"), where("status", "==", "Dalam Pengerjaan"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const activeWorkOrders = snapshot.docs.map(doc => ({ 
          id: doc.id, ...doc.data(), 
          date: doc.data().date.toDate(),
          startDate: doc.data().startDate.toDate(),
          endDate: doc.data().endDate.toDate(),
        } as WorkOrder));
        
      setWorkOrders(activeWorkOrders);
      setLoading(false);
    });

    return () => unsub();
  }, []);
  
  const handleProcess = (wo: WorkOrder) => {
    setSelectedWO(wo);
  }
  
  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(workOrders.map(wo => wo.id));
    } else {
      setSelectedRows([]);
    }
  }
  
  const handleBulkComplete = () => {
    startBulkTransition(async () => {
      const result = await completeMultipleProductions(selectedRows);
      if (result.error) {
        toast({ title: "Gagal Menyelesaikan WO", description: result.error, variant: 'destructive'});
      } else {
        toast({ title: "Berhasil", description: `${selectedRows.length} WO telah diselesaikan.`});
        setSelectedRows([]);
      }
    });
  }


  if (selectedWO) {
    return <ProductionExecutionForm wo={selectedWO} onBack={() => setSelectedWO(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex-1">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Lembar Kerja Produksi</h2>
        <p className="text-muted-foreground text-sm">Pilih WO untuk mencatat penyelesaian produksi dan konsumsi bahan.</p>
      </div>
      {selectedRows.length > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="font-semibold text-sm">{selectedRows.length} perintah produksi dipilih.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button>
                    <Check className="mr-2 h-4 w-4" /> Selesaikan Produksi Terpilih
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Selesaikan {selectedRows.length} Produksi?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tindakan ini akan menyelesaikan semua WO yang dipilih, dengan asumsi bahan baku yang digunakan sesuai dengan resep (BOM). Stok akan diperbarui secara otomatis. Lanjutkan?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkComplete} disabled={isBulkPending}>
                         {isBulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Ya, Selesaikan'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Perintah Produksi Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                    <Checkbox 
                        checked={workOrders.length > 0 && selectedRows.length === workOrders.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Pilih semua"
                    />
                </TableHead>
                <TableHead>Tanggal WO</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Tidak ada perintah produksi yang sedang dikerjakan.</TableCell></TableRow>
              ) : (
                workOrders.map(wo => (
                  <TableRow key={wo.id} className={cn(selectedRows.includes(wo.id) && 'bg-muted/50')}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedRows.includes(wo.id)}
                        onCheckedChange={() => handleSelectRow(wo.id)}
                        aria-label={`Pilih WO ${wo.id}`}
                      />
                    </TableCell>
                    <TableCell>{format(wo.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{wo.id}</TableCell>
                    <TableCell className="font-medium">{wo.finishedGoodName}</TableCell>
                    <TableCell>{wo.quantityToProduce}</TableCell>
                    <TableCell>
                        <Badge variant={'default'}>{wo.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleProcess(wo)}>
                        <Workflow className="mr-2 h-4 w-4" /> 
                        Selesaikan
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

function ProductionExecutionForm({ wo, onBack }: { wo: WorkOrder; onBack: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [bom, setBom] = useState<BillOfMaterial | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [consumedItems, setConsumedItems] = useState<Omit<NewProductionCompletion['consumedItems'][0], 'cost'>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const bomRef = doc(db, 'billOfMaterials', wo.bomId);
        const productsSnap = await getDocs(collection(db, 'products'));
        const bomSnap = await getDoc(bomRef);

        const allProducts = productsSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Product));
        setProducts(allProducts);

        if (bomSnap.exists()) {
          const bomData = { id: bomSnap.id, ...bomSnap.data() } as BillOfMaterial;
          setBom(bomData);
          
          if (bomData.items) {
             setConsumedItems(bomData.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity * wo.quantityToProduce / bomData.quantityProduced,
              })));
          }
        }
      } catch (error) {
        toast({title: "Gagal memuat data", description: (error as Error).message, variant: 'destructive'});
      } finally {
        setLoading(false);
      }
    };
    fetchDependencies();
  }, [wo, toast]);

  const handleQuantityChange = (productId: string, value: string) => {
    setConsumedItems(prev => prev.map(item => 
      item.productId === productId ? { ...item, quantity: Number(value) || 0 } : item
    ));
  };
  
  const totalCost = useMemo(() => {
    if (!bom) return 0;
    
    const rawMaterialCost = consumedItems.reduce((sum, consumed) => {
        const productInfo = products.find(p => p.id === consumed.productId);
        const itemCost = productInfo?.cost || 0;
        return sum + (itemCost * consumed.quantity);
    }, 0);

    const scaledAdditionalCost = bom.additionalCosts?.reduce((sum, cost) => {
        const scaledAmount = cost.amount * (wo.quantityToProduce / bom.quantityProduced);
        return sum + scaledAmount;
    }, 0) || 0;

    return rawMaterialCost + scaledAdditionalCost;
  }, [consumedItems, bom, products, wo.quantityToProduce]);


  const handleComplete = () => {
    if (consumedItems.some(item => item.quantity <= 0)) {
      toast({ title: 'Kuantitas tidak valid', description: 'Jumlah bahan baku yang digunakan harus lebih dari nol.', variant: 'destructive' });
      return;
    }

    const scaledAdditionalCosts = bom?.additionalCosts?.map(cost => ({
        ...cost,
        amount: cost.amount * (wo.quantityToProduce / bom.quantityProduced)
    })) || [];

    const completionData: NewProductionCompletion = {
      date: new Date(),
      workOrderId: wo.id,
      finishedGoodId: wo.finishedGoodId,
      finishedGoodName: wo.finishedGoodName,
      quantityProduced: wo.quantityToProduce,
      consumedItems,
      additionalCosts: scaledAdditionalCosts,
      totalCost,
    };

    startTransition(async () => {
      const result = await completeProduction(completionData);
      if (result.error) {
        toast({ title: 'Gagal Menyelesaikan Produksi', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Produksi Selesai!', description: `Stok dan jurnal untuk ${wo.finishedGoodName} telah diperbarui.` });
        onBack();
      }
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!bom) {
    return <div className="text-center text-destructive">Gagal memuat formula produksi (BOM) untuk Work Order ini.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Eksekusi Produksi untuk WO #{wo.id}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Produk: {wo.finishedGoodName} (x{wo.quantityToProduce})</CardTitle>
          <CardDescription>
            Konfirmasi jumlah bahan baku yang digunakan untuk menyelesaikan produksi ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bahan Baku</TableHead>
                <TableHead className="text-center w-[150px]">Jumlah Digunakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumedItems.map(item => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => handleQuantityChange(item.productId, e.target.value)}
                      className="text-center"
                      onFocus={(e) => e.target.select()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleComplete} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Selesaikan Produksi &amp; Update Stok
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
