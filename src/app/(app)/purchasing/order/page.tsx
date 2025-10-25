
'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { Plus, Save, Loader2, PlusCircle, MinusCircle, X, ChevronsUpDown, Check, ArrowLeft, Send, Eye, CheckCircle, XCircle } from 'lucide-react';
import type { Product, Supplier, PurchaseOrderItem, NewPurchaseOrder, PurchaseOrder, PurchaseRequest, ProductUnit, Tax } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { addPurchaseOrder, updatePurchaseOrderStatus, updatePurchaseRequestStatus } from '../actions';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


export default function PurchaseOrderPage() {
  const [view, setView] = useState<'list' | 'new'>('list');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poUnsub = onSnapshot(collection(db, "purchaseOrders"), (snapshot) => {
      const pos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as PurchaseOrder)).sort((a,b) => b.date.getTime() - a.date.getTime());
      setPurchaseOrders(pos);
      setLoading(false);
    });

    return () => poUnsub();
  }, []);

  if (view === 'new') {
    return <NewPurchaseOrderForm onBack={() => setView('list')} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Pesanan Pembelian (Purchase Order)</h1>
        <Button onClick={() => setView('new')}>
          <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Purchase Order</CardTitle>
          <CardDescription>Daftar semua pesanan pembelian yang pernah dibuat.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>No. PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Belum ada Purchase Order.</TableCell></TableRow>
              ) : (
                purchaseOrders.map(po => (
                  <TableRow key={po.id}>
                    <TableCell>{format(po.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{po.id}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell><POStatusBadge status={po.status} /></TableCell>
                    <TableCell className="text-right font-medium">Rp {(po.grandTotal ?? po.total).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                        <SendPOButton po={po} />
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

function NewPurchaseOrderForm({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [approvedPRs, setApprovedPRs] = useState<PurchaseRequest[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  const [selectedTaxId, setSelectedTaxId] = useState<string | undefined>();
  const [date, setDate] = useState<Date | undefined>();

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setDate(new Date());
    const productsUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const suppliersUnsub = onSnapshot(collection(db, "suppliers"), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
    const prsUnsub = onSnapshot(query(collection(db, "purchaseRequests"), where("status", "==", "Approved")), (snapshot) => {
      setApprovedPRs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate() } as PurchaseRequest)));
    });
     const taxesUnsub = onSnapshot(collection(db, "taxes"), (snapshot) => {
      setTaxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tax)));
    });

    return () => {
      productsUnsub();
      suppliersUnsub();
      prsUnsub();
      taxesUnsub();
    };
  }, []);

  const handleSelectPR = async (pr: PurchaseRequest | null) => {
    setSelectedPR(pr);
    if (pr) {
      const itemPromises = pr.items.map(async item => {
          const productDoc = await getDoc(doc(db, "products", item.productId));
          if (!productDoc.exists()) return null;
          const productData = productDoc.data() as Product;
          const baseUnit = productData.units.find(u => u.name === productData.baseUnit) || productData.units[0];
          
          return {
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              cost: baseUnit?.cost || 0,
              unit: baseUnit?.name || 'N/A'
          } as PurchaseOrderItem;
      });
      const resolvedItems = (await Promise.all(itemPromises)).filter(Boolean) as PurchaseOrderItem[];
      setItems(resolvedItems);
    } else {
      setItems([]);
    }
  }
  
  const addItem = (product: Product) => {
    if (selectedPR) return; // Disable adding items manually if a PR is selected
    
    const baseUnit = product.units.find(u => u.name === product.baseUnit) || product.units[0];
    if (!baseUnit) {
        toast({ title: 'Satuan dasar tidak ditemukan untuk produk ini', variant: 'destructive' });
        return;
    }

    setItems(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        productName: product.name, 
        quantity: 1, 
        cost: baseUnit.cost,
        unit: baseUnit.name,
      }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (selectedPR) return; // Disable editing quantity if a PR is selected
    setItems(prev => {
      if (quantity <= 0) return prev.filter(item => item.productId !== productId);
      return prev.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      );
    });
  };

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const sub = items.reduce((total, item) => total + item.cost * item.quantity, 0);
    const tax = taxes.find(t => t.id === selectedTaxId);
    const taxRate = tax ? tax.rate / 100 : 0;
    const taxAmt = sub * taxRate;
    const grand = sub + taxAmt;
    return { subtotal: sub, taxAmount: taxAmt, grandTotal: grand };
  }, [items, selectedTaxId, taxes]);

  const resetForm = () => {
    setItems([]);
    setSelectedSupplier(null);
    setSelectedPR(null);
    setSelectedTaxId(undefined);
    setDate(new Date());
    onBack();
  };

  const handleSavePO = () => {
    if (items.length === 0 || !selectedSupplier || !date) {
      toast({ title: 'Data tidak lengkap', description: 'Supplier, tanggal, dan minimal satu produk harus dipilih.', variant: 'destructive' });
      return;
    }

    const selectedTax = taxes.find(t => t.id === selectedTaxId);

    startTransition(async () => {
      const newPO: NewPurchaseOrder = {
        date,
        items,
        subtotal,
        taxId: selectedTax?.id,
        taxName: selectedTax?.name,
        taxRate: selectedTax?.rate,
        taxAmount,
        grandTotal,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        status: 'Draft',
        ...(selectedPR && { purchaseRequestId: selectedPR.id })
      };

      const result = await addPurchaseOrder(newPO);
      
      if (result.error) {
        toast({ title: 'Gagal Menyimpan PO', description: result.error, variant: 'destructive' });
      } else {
        if (selectedPR) {
            await updatePurchaseRequestStatus(selectedPR.id, 'Processed');
        }
        toast({ title: 'Purchase Order Berhasil Disimpan', description: `PO untuk ${selectedSupplier.name} telah dibuat.` });
        resetForm();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Buat Purchase Order Baru</h1>
        <Button variant="ghost" onClick={onBack}>Kembali</Button>
      </div>
        <Card>
          <CardHeader>
            <CardTitle>Detail Pesanan Pembelian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-1">
                 <Label>Dari Purchase Request (Opsional)</Label>
                 <DataPicker 
                    data={approvedPRs} 
                    selected={selectedPR} 
                    onSelect={handleSelectPR}
                    placeholder="Pilih PR yang disetujui..." 
                    nameKey="id"
                    renderItem={(pr) => `${pr.id.substring(0,5)}... - ${pr.requestedBy}`}
                  />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Pemasok (Supplier)</Label>
                <DataPicker data={suppliers} selected={selectedSupplier} onSelect={setSelectedSupplier} placeholder="Pilih pemasok..." nameKey="name" />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Tanggal PO</Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
            </div>
            <div className="space-y-2">
               <Label>Item Pesanan</Label>
               {items.length > 0 && (
                  <div className="border rounded-md">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Produk</TableHead>
                                  <TableHead className="w-[120px]">Jumlah</TableHead>
                                  <TableHead>Harga Pokok</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {items.map(item => (
                              <TableRow key={item.productId}>
                                  <TableCell className="font-medium">{item.productName}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity - 1)} disabled={!!selectedPR}>
                                        <MinusCircle className="h-4 w-4" />
                                      </Button>
                                      <span>{item.quantity}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={!!selectedPR}>
                                        <PlusCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>Rp {(item.cost).toLocaleString('id-ID')}</TableCell>
                                  <TableCell className="text-right">Rp {(item.cost * item.quantity).toLocaleString('id-ID')}</TableCell>
                                  <TableCell>
                                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, 0)} disabled={!!selectedPR}>
                                      <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                  </TableCell>
                              </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
               )}
               <DataPicker data={products} onSelect={addItem} placeholder="Tambah Produk..." nameKey="name" disabled={!!selectedPR} />
            </div>
             <div className="flex justify-end">
                <div className="w-full max-w-sm space-y-4">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <Label>Pajak</Label>
                        <Select value={selectedTaxId} onValueChange={setSelectedTaxId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Pilih Pajak" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Tanpa Pajak</SelectItem>
                                {taxes.map(tax => (
                                    <SelectItem key={tax.id} value={tax.id}>{tax.name} ({tax.rate}%)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">PPN Masukan</span>
                        <span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <hr/>
                    <div className="flex justify-between font-bold text-lg">
                        <span>Grand Total</span>
                        <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleSavePO} disabled={isPending || !selectedSupplier || items.length === 0}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Purchase Order
            </Button>
          </CardFooter>
        </Card>
    </div>
  );
}

function DataPicker<T extends {id: string; [key: string]: any}>({ data, selected, onSelect, placeholder, nameKey, disabled, renderItem }: { data: T[], selected?: T | null, onSelect: (item: T | null) => void, placeholder: string, nameKey: keyof T, disabled?: boolean, renderItem?: (item: T) => string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between" disabled={disabled}>
          {selected ? (renderItem ? renderItem(selected) : selected[nameKey]) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Cari..." />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {data.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item[nameKey]}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === item.id ? "opacity-100" : "opacity-0")} />
                  {renderItem ? renderItem(item) : item[nameKey]}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


function POStatusBadge({ status }: { status: PurchaseOrder['status'] }) {
    const variants = {
        Draft: 'default',
        Sent: 'secondary',
        Completed: 'outline',
        Cancelled: 'destructive'
    } as const;
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
}

function SendPOButton({ po }: { po: PurchaseOrder }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSend = () => {
        startTransition(async () => {
            const result = await updatePurchaseOrderStatus(po.id, 'Sent');
            if (result.error) {
                toast({ title: "Gagal mengirim PO", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "PO berhasil dikirim", description: `Status PO #${po.id} telah diubah menjadi "Sent".` });
            }
        });
    };

    if (po.status !== 'Draft') return null;

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline"><Send className="mr-2 h-4 w-4"/> Kirim</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Kirim Purchase Order?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Ini akan mengubah status PO menjadi "Sent" dan membuatnya siap untuk proses penerimaan barang.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSend} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Ya, Kirim PO
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

