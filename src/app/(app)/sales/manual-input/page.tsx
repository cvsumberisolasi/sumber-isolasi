

'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { PlusCircle, MinusCircle, X, Save, Loader2, UserPlus, Printer } from 'lucide-react';
import type { Product, CartItem, NewTransaction, Customer, ProductUnit, Transaction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { createTransaction } from '@/app/(app)/pos/actions';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomerFormDialog } from '@/components/customers/customer-actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CompanySettings, getCompanySettings } from '@/app/(app)/settings/actions';
import Image from 'next/image';
import { format } from 'date-fns';
import { InvoicePreview } from '@/components/common/invoice-preview';

export default function ManualSalesInputPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [invoice, setInvoice] = useState<Transaction | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    getCompanySettings().then(setCompanySettings);
    setDate(new Date());
    const productsUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const customersUnsub = onSnapshot(query(collection(db, 'customers'), ), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => {
      productsUnsub();
      customersUnsub();
    };
  }, []);
  
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

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(prevCart => {
      if (quantity <= 0) return prevCart.filter(item => item.product.id !== productId);
      return prevCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.unit.price * item.quantity, 0);
  }, [cart]);

  const resetForm = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDate(new Date());
    setInvoice(null);
  };
  
  const handlePrint = () => {
      window.print();
  }
  
  const handleDialogClose = () => {
    resetForm();
  }

  const handleSaveInvoice = () => {
    if (cart.length === 0 || !selectedCustomer || !date) {
      toast({ title: 'Data tidak lengkap', description: 'Pelanggan, tanggal, dan minimal satu produk harus dipilih.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const newTransaction: NewTransaction = {
        date,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.unit.price,
          cost: item.unit.cost,
          unit: item.unit.name,
        })),
        total: cartTotal,
        paymentMethod: 'Kredit',
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
      };

      const result = await createTransaction(newTransaction, false);
      
      if (result.error) {
        toast({ title: 'Gagal Menyimpan Invoice', description: result.error, variant: 'destructive' });
      } else {
        const fullTransaction: Transaction = {
            id: result.id!,
            ...newTransaction,
            status: 'Belum Lunas',
            date: date
        }
        setInvoice(fullTransaction);
        toast({ title: 'Invoice Berhasil Disimpan', description: `Invoice untuk ${selectedCustomer.name} telah dibuat.` });
      }
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Input Penjualan Manual (Invoice)</h1>
        <Card>
          <CardHeader>
            <CardTitle>Detail Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pelanggan</Label>
                <div className="flex gap-2">
                  <CustomerPicker customers={customers} selected={selectedCustomer} onSelect={setSelectedCustomer} />
                  <CustomerFormDialog>
                      <Button variant="outline" size="icon" aria-label="Tambah pelanggan baru">
                          <UserPlus className="h-4 w-4" />
                      </Button>
                  </CustomerFormDialog>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Invoice</Label>
                <DatePicker date={date} setDate={setDate} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Item Invoice</Label>
              {cart.length > 0 && (
                  <div className="border rounded-md overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Produk</TableHead>
                                  <TableHead className="w-[120px]">Jumlah</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {cart.map(item => (
                              <TableRow key={item.product.id}>
                                  <TableCell className="font-medium">{item.product.name}</TableCell>
                                  <TableCell>
                                  <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                      <MinusCircle className="h-4 w-4" />
                                      </Button>
                                      <span>{item.quantity}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                      <PlusCircle className="h-4 w-4" />
                                      </Button>
                                  </div>
                                  </TableCell>
                                  <TableCell className="text-right">Rp {(item.unit.price * item.quantity).toLocaleString('id-ID')}</TableCell>
                                  <TableCell>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, 0)}>
                                      <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                  </TableCell>
                              </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              )}
              <ProductPicker products={products} onSelect={addToCart} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/50 p-6">
              <div className="text-lg font-bold">
                  Total Invoice: Rp {cartTotal.toLocaleString('id-ID')}
              </div>
            <Button onClick={handleSaveInvoice} disabled={isPending || !selectedCustomer || cart.length === 0} className="w-full sm:w-auto">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan & Pratinjau Invoice
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {invoice && selectedCustomer && companySettings && (
        <Dialog open={!!invoice} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="max-w-4xl print:max-w-none print:border-none print:shadow-none print:p-0">
                <DialogHeader className="print:hidden">
                    <DialogTitle>Pratinjau Invoice</DialogTitle>
                    <DialogDescription>Invoice berhasil dibuat. Anda dapat mencetaknya sekarang.</DialogDescription>
                </DialogHeader>
                <div id="printable-invoice" className="p-2 print:p-0">
                    <InvoicePreview transaction={invoice} companySettings={companySettings} customer={selectedCustomer} />
                </div>
                <DialogFooter className="print:hidden">
                    <Button variant="outline" onClick={handleDialogClose}>Tutup & Buat Baru</Button>
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Cetak Invoice</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      <style jsx global>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .print-hidden, .print-hidden * {
                visibility: hidden;
            }
            #printable-invoice, #printable-invoice * {
                visibility: visible;
            }
            #printable-invoice {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                padding: 0;
                margin: 0;
            }
            @page {
                size: A4 portrait;
                margin: 0;
            }
        }
      `}</style>
    </>
  );
}

function ProductPicker({ products, onSelect }: { products: Product[], onSelect: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          Tambah Produk...
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
                  <Check className={cn("mr-2 h-4 w-4", value === product.name ? "opacity-100" : "opacity-0")} />
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


function CustomerPicker({ customers, selected, onSelect }: { customers: Customer[], selected: Customer | null, onSelect: (customer: Customer | null) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selected ? selected.name : "Pilih pelanggan..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Cari pelanggan..." />
          <CommandList>
            <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  onSelect={() => {
                    onSelect(customer);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected?.id === customer.id ? "opacity-100" : "opacity-0")} />
                  {customer.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
