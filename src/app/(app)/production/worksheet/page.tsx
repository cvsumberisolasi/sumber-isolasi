
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkOrder, BillOfMaterial, Product, ProductionCompletionItem, NewProductionCompletion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save, Workflow, Check } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { completeProduction, updateWorkOrderStatus } from '../actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function ProductionWorksheetPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const q = query(collection(db, "workOrders"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const allWorkOrders = snapshot.docs.map(doc => ({ 
          id: doc.id, ...doc.data(), 
          date: doc.data().date.toDate(),
          startDate: doc.data().startDate.toDate(),
          endDate: doc.data().endDate.toDate(),
        } as WorkOrder));
      
      const activeWorkOrders = allWorkOrders.filter(wo => 
        wo.status === 'Belum Diproses' || wo.status === 'Dalam Pengerjaan'
      );
        
      setWorkOrders(activeWorkOrders);
      setLoading(false);
    });

    return () => unsub();
  }, []);
  
  const handleProcess = (wo: WorkOrder) => {
    if (wo.status === 'Belum Diproses') {
        startTransition(async () => {
            const result = await updateWorkOrderStatus(wo.id, 'Dalam Pengerjaan');
            if (result.error) {
                toast({title: 'Gagal Memulai', description: result.error, variant: 'destructive'});
            } else {
                toast({title: 'Dimulai', description: `Produksi untuk WO #${wo.id} telah dimulai.`});
                setSelectedWO(wo);
            }
        });
    } else {
        setSelectedWO(wo);
    }
  }


  if (selectedWO) {
    return <ProductionExecutionForm wo={selectedWO} onBack={() => setSelectedWO(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Lembar Kerja Produksi</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Perintah Produksi Aktif</CardTitle>
          <CardDescription>Pilih perintah kerja (Work Order) untuk memulai atau melanjutkan eksekusi produksi.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : workOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada perintah produksi yang aktif.</TableCell></TableRow>
              ) : (
                workOrders.map(wo => (
                  <TableRow key={wo.id}>
                    <TableCell>{format(wo.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{wo.id}</TableCell>
                    <TableCell className="font-medium">{wo.finishedGoodName}</TableCell>
                    <TableCell>{wo.quantityToProduce}</TableCell>
                    <TableCell>
                        <Badge variant={wo.status === 'Dalam Pengerjaan' ? 'default' : 'secondary'}>{wo.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleProcess(wo)} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        <Workflow className="mr-2 h-4 w-4" /> 
                        {wo.status === 'Belum Diproses' ? 'Mulai Produksi' : 'Lanjutkan'}
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
  const [consumedItems, setConsumedItems] = useState<ProductionCompletionItem[]>([]);
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
          const bomData = bomSnap.data() as Omit<BillOfMaterial, 'id'>;
          setBom({ id: bomSnap.id, ...bomData });
          
          if (bomData.items) {
             setConsumedItems(bomData.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
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

    const additionalCost = bom.additionalCosts?.reduce((sum, cost) => sum + cost.amount, 0) || 0;

    return rawMaterialCost + additionalCost;
  }, [consumedItems, bom, products]);


  const handleComplete = () => {
    if (consumedItems.some(item => item.quantity <= 0)) {
      toast({ title: 'Kuantitas tidak valid', description: 'Jumlah bahan baku yang digunakan harus lebih dari nol.', variant: 'destructive' });
      return;
    }

    const completionData: NewProductionCompletion = {
      date: new Date(),
      workOrderId: wo.id,
      finishedGoodId: wo.finishedGoodId,
      finishedGoodName: wo.finishedGoodName,
      quantityProduced: wo.quantityToProduce,
      consumedItems,
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
