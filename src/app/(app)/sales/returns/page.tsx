
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, Save, MinusCircle, PlusCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTransaction, processSalesReturn } from '@/app/(app)/pos/actions';
import type { Transaction, TransactionItem, NewSalesReturn } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { id } from 'date-fns/locale';

type ReturnItem = TransactionItem & { returnQuantity: number };

export default function SalesReturnsPage() {
  const [txId, setTxId] = useState('');
  const [isSearching, startSearching] = useTransition();
  const [isProcessing, startProcessing] = useTransition();

  const [creditTransactions, setCreditTransactions] = useState<Transaction[]>([]);
  const [originalTx, setOriginalTx] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const allTransactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate()
        } as Transaction));
        setCreditTransactions(allTransactions.filter(tx => tx.paymentMethod === 'Kredit'));
    });
    return () => unsub();
  }, []);

  const handleSearch = () => {
    if (!txId) {
      toast({ title: 'ID Transaksi diperlukan', variant: 'destructive' });
      return;
    }
    startSearching(async () => {
      const result = await getTransaction(txId);
      if (result.error || result.data?.paymentMethod !== 'Kredit') {
        toast({ title: 'Transaksi tidak ditemukan atau bukan transaksi kredit', description: result.error || 'Hanya transaksi kredit yang bisa diretur di halaman ini.', variant: 'destructive' });
        setOriginalTx(null);
        setReturnItems([]);
      } else {
        const tx = result.data as Transaction;
        setOriginalTx(tx);
        setReturnItems(tx.items.map(item => ({ ...item, returnQuantity: 0 })));
      }
    });
  };

  const updateReturnQuantity = (productId: string, change: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQuantity = item.returnQuantity + change;
        if (newQuantity >= 0 && newQuantity <= item.quantity) {
          return { ...item, returnQuantity: newQuantity };
        }
      }
      return item;
    }));
  };

  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((total, item) => total + (item.price * item.returnQuantity), 0);
  }, [returnItems]);

  const handleProcessReturn = () => {
    if (!originalTx) return;
    
    const itemsToReturn = returnItems
      .filter(item => item.returnQuantity > 0)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.returnQuantity,
        price: item.price,
        cost: item.cost,
        unit: item.unit
      }));

    if (itemsToReturn.length === 0) {
      toast({ title: 'Tidak ada item dipilih', description: 'Pilih jumlah item yang akan diretur.', variant: 'destructive' });
      return;
    }
     if (totalReturnAmount > originalTx.total && originalTx.status === 'Belum Lunas') {
        toast({ title: 'Total retur melebihi sisa piutang', variant: 'destructive'});
        return;
    }

    const returnData: NewSalesReturn = {
      date: new Date(),
      originalTransactionId: originalTx.id,
      items: itemsToReturn,
      total: totalReturnAmount,
      originalPaymentMethod: originalTx.paymentMethod,
    };

    startProcessing(async () => {
        const result = await processSalesReturn(returnData);
        if (result.error) {
            toast({ title: 'Gagal memproses retur', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Retur berhasil diproses', description: `ID Retur: ${result.id}`});
            setOriginalTx(null);
            setReturnItems([]);
            setTxId('');
        }
    });
  }
  
  const resetSearch = () => {
    setOriginalTx(null);
    setReturnItems([]);
    setTxId('');
  }


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Retur Penjualan (Non-POS)</h1>
      
      {!originalTx && (
        <Card className="max-w-xl mx-auto w-full">
            <CardHeader>
            <CardTitle>Cari Invoice Penjualan</CardTitle>
            <CardDescription>Pilih invoice penjualan kredit untuk memulai proses retur.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                <Label htmlFor="tx-id">ID Transaksi / Invoice</Label>
                <div className="flex gap-2">
                <Select
                    value={txId}
                    onValueChange={setTxId}
                    disabled={isSearching}
                >
                    <SelectTrigger id="tx-id">
                        <SelectValue placeholder="Pilih invoice..."/>
                    </SelectTrigger>
                    <SelectContent>
                        {creditTransactions.map(tx => (
                            <SelectItem key={tx.id} value={tx.id}>
                                {tx.id} - {tx.customerName} - Rp {tx.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={isSearching || !txId}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
                </div>
            </div>
            </CardContent>
        </Card>
      )}

      {isSearching && <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /> <p>Mencari...</p></div>}
      
      {originalTx && (
        <Card>
          <CardHeader>
            <Button variant="ghost" onClick={resetSearch} className="mb-4 w-fit p-0 h-auto">
                <ArrowLeft className="mr-2 h-4 w-4"/> Kembali ke pencarian
            </Button>
            <CardTitle>Detail Invoice #{originalTx.id}</CardTitle>
            <CardDescription>
              Transaksi pada {format(originalTx.date, 'dd MMMM yyyy')} untuk {originalTx.customerName}. <br/>
              Pilih item dan jumlah yang akan diretur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Jumlah Beli</TableHead>
                  <TableHead className="text-center w-[150px]">Jumlah Retur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnItems.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">Rp {item.price.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateReturnQuantity(item.productId, -1)} disabled={item.returnQuantity === 0}>
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <span className="font-bold">{item.returnQuantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateReturnQuantity(item.productId, 1)} disabled={item.returnQuantity === item.quantity}>
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex flex-col items-end gap-4">
            <div className="text-lg font-bold">
              Total Nilai Retur: Rp {totalReturnAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            </div>
             <p className="text-sm text-muted-foreground -mt-2">
                Total piutang akan dikurangi sejumlah nilai retur.
             </p>
            <div className="flex gap-2">
                 <Button variant="outline" onClick={resetSearch}>Batal</Button>
                <Button onClick={handleProcessReturn} disabled={isProcessing || totalReturnAmount === 0}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Proses Retur
                </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
