

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wallet, User, CheckCircle2, ArrowLeft, ArrowRight, Search, Printer, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import type { Transaction, Customer, Account } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit, startAfter, DocumentData, getDocs, Query, endBefore, limitToLast, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanySettings, getCompanySettings } from '@/app/(app)/settings/actions';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { InvoicePreview } from '@/components/common/invoice-preview';
import { useToast } from '@/hooks/use-toast';
import { settleReceivable } from '@/app/(app)/pos/actions';
import { Label } from '@/components/ui/label';

const TRANSACTIONS_PER_PAGE = 300;
type SortOption = "date_desc" | "total_desc" | "total_asc";


function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const initialSearchId = searchParams.get('search') || '';

  const [date, setDate] = useState<DateRange | undefined>();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
  const [firstVisible, setFirstVisible] = useState<DocumentData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(initialSearchId);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<Transaction | null>(null);
  const [selectedCustomerForPrint, setSelectedCustomerForPrint] = useState<Customer | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);


  useEffect(() => {
    getCompanySettings().then(setCompanySettings);
    fetchTransactions('initial');
  }, [date, sortOption]);

  const getBaseQuery = () => {
    const transactionsCol = collection(db, "transactions");
    let baseQuery: Query<DocumentData> = query(transactionsCol);

    if (date?.from) {
      const from = Timestamp.fromDate(date.from);
      let to;
      if (date.to) {
        const toDayEnd = new Date(date.to);
        toDayEnd.setHours(23, 59, 59, 999);
        to = Timestamp.fromDate(toDayEnd);
      } else {
        const fromDayEnd = new Date(date.from);
        fromDayEnd.setHours(23, 59, 59, 999);
        to = Timestamp.fromDate(fromDayEnd);
      }
      baseQuery = query(baseQuery, where("date", ">=", from), where("date", "<=", to));
    }
    
    const [sortField, sortDirection] = sortOption.split('_');
    baseQuery = query(baseQuery, orderBy(sortField, sortDirection as "desc" | "asc"));

    return baseQuery;
  };

  const fetchTransactions = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    
    const baseQuery = getBaseQuery();
    
    let q: Query<DocumentData>;
    if (direction === 'next' && lastVisible) {
        q = query(baseQuery, startAfter(lastVisible), limit(TRANSACTIONS_PER_PAGE));
    } else if (direction === 'prev' && firstVisible) {
        q = query(baseQuery, endBefore(firstVisible), limitToLast(TRANSACTIONS_PER_PAGE));
    } else {
        q = query(baseQuery, limit(TRANSACTIONS_PER_PAGE));
    }
    
    const snapshot = await getDocs(q);

    const transactionList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
      } as Transaction;
    });

    setAllTransactions(transactionList);

    if (snapshot.docs.length > 0) {
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setFirstVisible(snapshot.docs[0]);
      
      const nextDoc = snapshot.docs[snapshot.docs.length - 1];
      const nextQuery = query(baseQuery, startAfter(nextDoc), limit(1));
      const nextSnapshot = await getDocs(nextQuery);
      setHasNextPage(!nextSnapshot.empty);
    } else {
      setLastVisible(null);
      setFirstVisible(null);
      setHasNextPage(false);
    }
    
    setLoading(false);
  };
  

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) {
      return allTransactions;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return allTransactions.filter(tx => 
      tx.id.toLowerCase().includes(lowercasedQuery) ||
      tx.items.some(item => item.productName.toLowerCase().includes(lowercasedQuery))
    );
  }, [allTransactions, searchQuery]);
  
  const handleNextPage = () => {
      setCurrentPage(prev => prev + 1);
      fetchTransactions('next');
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      fetchTransactions('prev');
    }
  };


  const totalSales = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => sum + (tx.netTotal ?? tx.total), 0);
  }, [filteredTransactions]);
  
  const getPaymentBadge = (tx: Transaction) => {
      if (tx.paymentMethod === 'Kredit') {
          return (
              <Badge variant={tx.status === 'Lunas' ? 'secondary' : 'destructive'} className="flex items-center gap-1">
                {tx.status === 'Lunas' ? <CheckCircle2 size={12}/> : <Wallet size={12}/>}
                {tx.status}
            </Badge>
          )
      }
      return (
         <Badge variant={tx.paymentMethod === 'Tunai' ? 'default' : 'secondary'} className="flex items-center gap-1">
            <Wallet size={12}/>{tx.paymentMethod}
        </Badge>
      )
  }
  
  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    setCurrentPage(1);
    setLastVisible(null);
    setFirstVisible(null);
  }

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPrintDialog = async (tx: Transaction) => {
      setSelectedTxForPrint(tx);
      if (tx.customerId) {
        const customerSnap = await getDoc(doc(db, 'customers', tx.customerId));
        if (customerSnap.exists()) {
            setSelectedCustomerForPrint(customerSnap.data() as Customer);
        }
      } else {
        setSelectedCustomerForPrint(null);
      }
  };

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Riwayat Transaksi</h1>

        <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                      <CardTitle className="font-headline">Semua Transaksi</CardTitle>
                      <CardDescription>Total penjualan bersih untuk periode yang dipilih (pada halaman ini).</CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                      <p className="text-sm text-muted-foreground">Total Penjualan Bersih</p>
                      <p className="text-xl sm:text-2xl font-bold">Rp {totalSales.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full pt-4">
                <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cari ID atau nama produk..."
                        className="pl-8 sm:w-auto md:w-[250px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={sortOption} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Urutkan berdasarkan..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date_desc">Tanggal (Terbaru)</SelectItem>
                        <SelectItem value="total_desc">Harga (Tertinggi)</SelectItem>
                        <SelectItem value="total_asc">Harga (Terendah)</SelectItem>
                    </SelectContent>
                </Select>
                <DateRangePicker 
                    className="w-full sm:w-[300px]" 
                    onSelect={(newDate) => {
                        setDate(newDate);
                        setCurrentPage(1); // Reset to first page on date change
                    }}
                />
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" defaultValue={initialSearchId || undefined}>
              {loading ? (
                  <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Memuat data transaksi...</div>
              ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                      {searchQuery ? `Tidak ada transaksi yang cocok dengan "${searchQuery}".` : "Tidak ada transaksi pada periode ini."}
                  </div>
              ) : (
                  filteredTransactions.map((tx, index) => (
                      <AccordionItem value={tx.id} key={tx.id}>
                          <AccordionTrigger>
                          <div className="flex flex-col sm:flex-row justify-between w-full sm:pr-4 text-left sm:items-center">
                              <div className="flex items-center gap-4 mb-2 sm:mb-0">
                                  <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
                                      { (currentPage - 1) * TRANSACTIONS_PER_PAGE + index + 1 }
                                  </span>
                                  <div>
                                      <p className="font-semibold text-sm sm:text-base font-mono">
                                      #{tx.id}
                                      </p>
                                      <p className="text-xs sm:text-sm text-muted-foreground">{format(tx.date, "eeee, dd MMM yyyy 'pukul' HH:mm", { locale: id })}</p>
                                      {tx.customerName && (
                                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1"><User size={12}/>{tx.customerName}</p>
                                      )}
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4 justify-between">
                                  {getPaymentBadge(tx)}
                                  <p className="font-bold text-md sm:text-lg text-primary">Rp {(tx.netTotal ?? tx.total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                              </div>
                          </div>
                          </AccordionTrigger>
                          <AccordionContent>
                          <div className="overflow-x-auto">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                      <TableHead>Produk</TableHead>
                                      <TableHead>Jumlah</TableHead>
                                      <TableHead>Harga</TableHead>
                                      <TableHead className="text-right">Subtotal</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {tx.items.map((item, index) => (
                                      <TableRow key={`${item.productId}-${index}`}>
                                          <TableCell>{item.productName || item.productId}</TableCell>
                                          <TableCell>{item.quantity}</TableCell>
                                          <TableCell>Rp {item.price.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                          <TableCell className="text-right">Rp {(item.price * item.quantity).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                      </TableRow>
                                      ))}
                                  </TableBody>
                                  {tx.discount || tx.fee ? (
                                      <TableFooter>
                                          <TableRow>
                                              <TableCell colSpan={3} className="text-right">Subtotal</TableCell>
                                              <TableCell className="text-right font-medium">Rp {tx.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                          </TableRow>
                                          {tx.discount ? (
                                          <TableRow>
                                              <TableCell colSpan={3} className="text-right">Diskon</TableCell>
                                              <TableCell className="text-right text-destructive">- Rp {tx.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                          </TableRow>
                                          ) : null}
                                          {tx.fee ? (
                                              <TableRow>
                                                  <TableCell colSpan={3} className="text-right">Biaya Marketplace</TableCell>
                                                  <TableCell className="text-right text-destructive">- Rp {tx.fee.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                              </TableRow>
                                          ) : null}
                                          <TableRow className="font-bold">
                                              <TableCell colSpan={3} className="text-right">Total Bersih</TableCell>
                                              <TableCell className="text-right">Rp {tx.netTotal?.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                          </TableRow>
                                      </TableFooter>
                                  ) : null}
                              </Table>
                              <div className="flex justify-end gap-2 mt-4">
                                {tx.status === 'Belum Lunas' && <SettleReceivableDialog transaction={tx} onSettled={() => fetchTransactions('initial')} />}
                                <Button variant="outline" onClick={() => handleOpenPrintDialog(tx)}>
                                  <Printer className="mr-2 h-4 w-4" /> Cetak Invoice
                                </Button>
                              </div>
                          </div>
                          </AccordionContent>
                      </AccordionItem>
                  ))
              )}
            </Accordion>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
              <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrevPage} disabled={currentPage === 1 || loading}>
                      <ArrowLeft className="mr-2 h-4 w-4"/> Sebelumnya
                  </Button>
                  <Button variant="outline" onClick={handleNextPage} disabled={!hasNextPage || loading}>
                      Berikutnya <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
              </div>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={!!selectedTxForPrint} onOpenChange={(open) => !open && setSelectedTxForPrint(null)}>
        <DialogContent className="max-w-4xl print:max-w-none print:border-none print:shadow-none print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>Pratinjau Invoice #{selectedTxForPrint?.id}</DialogTitle>
          </DialogHeader>
          <div id="printable-invoice" className="p-2 print:p-0">
            {selectedTxForPrint && companySettings && (
              <InvoicePreview 
                transaction={selectedTxForPrint} 
                companySettings={companySettings} 
                customer={selectedCustomerForPrint}
              />
            )}
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setSelectedTxForPrint(null)}>Tutup</Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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

function SettleReceivableDialog({ transaction, onSettled }: { transaction: Transaction, onSettled: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, 'coa'), where('type', '==', 'Kas & Bank'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCashBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });
        return () => unsubscribe();
    }, [open]);

    const handleSettle = () => {
        if (!paymentAccountId) {
            toast({ title: 'Akun pembayaran harus dipilih', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            try {
                await settleReceivable(transaction.id, paymentAccountId);
                toast({ title: 'Piutang berhasil dilunasi!', description: `Transaksi #${transaction.id} telah diperbarui.` });
                onSettled();
                setOpen(false);
            } catch (error) {
                const e = error as Error;
                toast({ title: 'Gagal melunasi piutang', description: e.message, variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                    <HandCoins className="mr-2 h-4 w-4" /> Tandai Lunas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pelunasan Piutang</DialogTitle>
                    <DialogDescription>
                        Anda akan melunasi transaksi #{transaction.id} sebesar Rp {(transaction.grandTotal || transaction.total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}. Pilih akun bank/kas tujuan penerimaan dana.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Label htmlFor="payment-account">Akun Penerimaan Pembayaran</Label>
                    <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                        <SelectTrigger id="payment-account">
                            <SelectValue placeholder="Pilih akun kas/bank..." />
                        </SelectTrigger>
                        <SelectContent>
                            {cashBankAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
                    <Button onClick={handleSettle} disabled={isPending || !paymentAccountId}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfirmasi Lunas'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function TransactionsPage() {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <TransactionsPageContent />
        </React.Suspense>
    )
}

declare module '@/components/ui/date-range-picker' {
    interface DateRangePickerProps {
        onSelect?: (date?: DateRange) => void;
        className?: string;
    }
}
