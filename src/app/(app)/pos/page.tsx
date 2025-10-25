
"use client";

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { PlusCircle, MinusCircle, X, Search, Printer, DollarSign, Loader2, ParkingSquare, ChevronsUpDown, Check } from 'lucide-react';
import type { Product, CartItem, Transaction, NewTransaction, TransactionItem, NewParkedTransaction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { createTransaction, parkTransaction } from './actions';
import { collection, getDocs, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CompanySettings, getCompanySettings } from '@/app/(app)/settings/actions';
import Image from 'next/image';

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // For parking transaction
  const [parkName, setParkName] = useState('');
  const [isParkDialogOpen, setIsParkDialogOpen] = useState(false);

  useEffect(() => {
    getCompanySettings().then(setCompanySettings);
    // Resume cart from local storage if exists
    try {
        const resumedCart = localStorage.getItem('resumedCart');
        if (resumedCart) {
            const parsedCart = JSON.parse(resumedCart);
            if (Array.isArray(parsedCart) && parsedCart.length > 0) {
                setCart(parsedCart);
            }
        }
    } catch (e) {
        console.error("Failed to parse resumed cart from localStorage", e);
    } finally {
        localStorage.removeItem('resumedCart');
    }

    const productsCol = collection(db, "products");
    const unsubscribeProducts = onSnapshot(productsCol, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productList);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const transactionsCol = collection(db, "transactions");
    const q = query(transactionsCol, where("date", ">=", todayTimestamp));
     const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        const transactionList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate(),
            } as Transaction;
        }).sort((a, b) => b.date.getTime() - a.date.getTime());
       setRecentTransactions(transactionList);
    });

    return () => {
        unsubscribeProducts();
        unsubscribeTransactions();
    }
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, products]);

  const addToCart = (product: Product) => {
    const baseUnit = product.units.find(u => u.conversionRate === 1) || product.units[0];
    if (!baseUnit) {
        toast({ title: 'Produk tidak valid', description: 'Satuan dasar produk tidak ditemukan.', variant: 'destructive' });
        return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id && item.unit.name === baseUnit.name);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && item.unit.name === baseUnit.name 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prevCart, { product, quantity: 1, unit: baseUnit }];
    });
  };

  const updateQuantity = (productId: string, unitName: string, quantity: number) => {
    setCart(prevCart => {
      if (quantity <= 0) {
        return prevCart.filter(item => !(item.product.id === productId && item.unit.name === unitName));
      }
      return prevCart.map(item =>
        item.product.id === productId && item.unit.name === unitName ? { ...item, quantity } : item
      );
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.unit.price * item.quantity, 0);
  }, [cart]);

  const handleParkTransaction = () => {
    if (cart.length === 0) {
      toast({ title: 'Keranjang kosong', description: 'Tidak ada yang bisa diparkir.', variant: 'destructive' });
      return;
    }
    const defaultName = `Diparkir pada ${new Date().toLocaleTimeString('id-ID')}`;
    setParkName(defaultName);
    setIsParkDialogOpen(true);
  }

  const confirmParkTransaction = () => {
      startTransition(async () => {
        const newParkedTx: NewParkedTransaction = {
            name: parkName,
            cart: cart,
            createdAt: new Date(),
        };
        const result = await parkTransaction(newParkedTx);
        if (result.error) {
            toast({ title: 'Gagal Memarkir', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Transaksi Berhasil Diparkir' });
            setCart([]);
            setIsParkDialogOpen(false);
            setParkName('');
        }
      });
  }

  const completeTransaction = (paymentMethod: 'Tunai' | 'Transfer') => {
    if (cart.length === 0) {
      toast({ title: 'Keranjang kosong', description: 'Tambahkan produk ke keranjang terlebih dahulu.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const newTransaction: NewTransaction = {
        date: new Date(),
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.unit.price,
          cost: item.unit.cost,
          unit: item.unit.name
        })),
        total: cartTotal,
        paymentMethod,
      };

      const result = await createTransaction(newTransaction);
      
      if (result.error) {
        toast({
          title: 'Transaksi Gagal',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        const generatedReceipt: Transaction = {
            id: result.id!,
            ...newTransaction,
            status: 'Lunas',
        };
        setReceipt(generatedReceipt);
        setCart([]);
        toast({ title: 'Transaksi Berhasil', description: `Total: Rp ${cartTotal.toLocaleString('id-ID')}` });
      }
    });
  };

  const printReceipt = () => {
    const receiptElement = document.getElementById('printable-area');
    if (!receiptElement || !receipt) return;
    
    html2canvas(receiptElement).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, canvas.height * 80 / canvas.width] // width 80mm, height adjusted to aspect ratio
        });
        pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
        pdf.save(`struk-${receipt.id}.pdf`);
    });
  };
  
  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || 'Produk Dihapus';
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full lg:h-[calc(100vh-6rem)]">
      <div className="lg:col-span-3 flex flex-col gap-4">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
             <ProductPicker products={products} onSelect={addToCart} />
          </CardHeader>
          <CardContent className="flex-1 h-0 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(product => {
                const baseUnit = product.units.find(u => u.conversionRate === 1) || product.units[0];
                return (
                    <Card key={product.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => addToCart(product)}>
                      <CardContent className="p-3 sm:p-4 flex flex-col items-center justify-center text-center">
                        <p className="font-semibold text-xs sm:text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Rp {baseUnit?.price.toLocaleString('id-ID')}</p>
                        <Badge className="mt-2" variant={product.stock > 0 ? 'secondary' : 'destructive'}>
                          Stok: {product.stock}
                        </Badge>
                      </CardContent>
                    </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2 flex flex-col gap-4">
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline">Keranjang</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto p-0 sm:p-6">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-center p-6 sm:p-0">Keranjang belanja kosong.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={`${item.product.id}-${item.unit.name}`}>
                        <TableCell className="px-2 sm:px-4">
                          <p className="font-medium text-sm sm:text-base">{item.product.name} ({item.unit.name})</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Rp {item.unit.price.toLocaleString('id-ID')}</p>
                        </TableCell>
                        <TableCell className="px-1 sm:px-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, item.unit.name, item.quantity - 1)}>
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <span className="text-sm sm:text-base">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, item.unit.name, item.quantity + 1)}>
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium px-2 sm:px-4 text-sm sm:text-base">
                          Rp {(item.unit.price * item.quantity).toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell className="px-1 sm:px-4">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, item.unit.name, 0)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-4 p-4">
            <div className="flex justify-between w-full text-md sm:text-lg font-bold">
              <span>Total</span>
              <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
             <Button variant="outline" className="w-full" onClick={handleParkTransaction} disabled={cart.length === 0 || isPending}>
                <ParkingSquare className="mr-2 h-4 w-4"/> Parkir Transaksi
             </Button>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button onClick={() => completeTransaction('Tunai')} disabled={cart.length === 0 || isPending}>
                 {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />} Tunai
              </Button>
              <Button onClick={() => completeTransaction('Transfer')} variant="secondary" disabled={cart.length === 0 || isPending}>
                 {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transfer
              </Button>
            </div>
          </CardFooter>
        </Card>
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="font-headline text-base">Riwayat Hari Ini</CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 overflow-y-auto">
             <Table>
                <TableBody>
                  {recentTransactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{tx.id}</p>
                        <p className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleTimeString('id-ID')}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-medium">Rp {tx.total.toLocaleString('id-ID')}</p>
                        <Badge variant="outline">{tx.paymentMethod}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      </div>
      
      {/* Park transaction dialog */}
      <Dialog open={isParkDialogOpen} onOpenChange={setIsParkDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Parkir Transaksi</DialogTitle>
                <DialogDescription>Beri nama untuk keranjang ini agar mudah ditemukan nanti.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor="park-name">Nama Parkir</Label>
                <Input id="park-name" value={parkName} onChange={(e) => setParkName(e.target.value)} />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsParkDialogOpen(false)}>Batal</Button>
                <Button onClick={confirmParkTransaction} disabled={isPending || !parkName}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {receipt && (
        <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
          <DialogContent>
             <DialogHeader>
                <DialogTitle className="sr-only">Struk Transaksi</DialogTitle>
                <DialogDescription className="sr-only">Struk untuk transaksi #{receipt.id}</DialogDescription>
            </DialogHeader>
            <div id="printable-area" className="font-mono text-xs p-2">
              <div className="text-center space-y-1 mb-4">
                {companySettings?.logoDataUrl && <Image src={companySettings.logoDataUrl} alt="Logo" width={40} height={40} className="mx-auto" />}
                <h2 className="text-base font-bold font-headline">{companySettings?.companyName || "Toko Kilat"}</h2>
                <p className="text-xs">{companySettings?.address}</p>
                <p className="text-xs">{companySettings?.phone}</p>
                <p>{new Date(receipt.date).toLocaleString('id-ID')}</p>
                <p>#{receipt.id}</p>
              </div>

              <div className="space-y-1 border-t border-dashed pt-2">
                {receipt.items.map(item => (
                  <div key={item.productId}>
                    <p>{item.productName}</p>
                    <div className="flex justify-between">
                      <span>{item.quantity} x {item.price.toLocaleString('id-ID')}</span>
                      <span>{(item.quantity * item.price).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>Rp {receipt.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pembayaran</span>
                  <span>{receipt.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-dashed my-2"></div>
              
              <p className="text-center mt-4">Terima kasih telah berbelanja!</p>
            </div>
            <DialogFooter>
              <Button onClick={printReceipt} className="w-full">
                <Printer className="mr-2 h-4 w-4"/> Cetak Struk
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
    
function ProductPicker({ products, onSelect }: { products: Product[], onSelect: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          Cari & tambah produk...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Cari produk..." onValueChange={setValue} />
          <CommandList>
            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {product.name} (Stok: {product.stock})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


    
    



