
'use client';

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  File,
  Loader2,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  XCircle,
  ChevronsUpDown,
  Check,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Landmark,
  Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Product, ImportRow, SkuMapping } from '@/lib/types';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { importMarketplaceTransactionsInChunks } from './actions';
import { addOrUpdateSkuMapping } from './mapping/actions';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';


export default function ImportMarketplacePage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  const [skuToProductMap, setSkuToProductMap] = useState<Record<string, Product | null>>({});

  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubMappings = onSnapshot(query(collection(db, 'skuMappings')), (snapshot) => {
        setSkuMappings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SkuMapping)));
    });

    return () => {
      unsubProducts();
      unsubMappings();
    };
  }, []);

  const { allProductsMapped, uniqueOrderCount, totalItems, unmappedSkus, summary } = useMemo(() => {
    if (parsedData.length === 0) {
      return { allProductsMapped: false, uniqueOrderCount: 0, totalItems: 0, unmappedSkus: [], summary: null };
    }
    
    const uniqueSkus = [...new Set(parsedData.map(row => row.sku))];
    const unmapped = uniqueSkus.filter(sku => !skuToProductMap[sku]);

    const uniqueOrders = new Set(parsedData.map(row => row.nomor_order));
    const totalItems = parsedData.reduce((sum, row) => sum + row.qty, 0);
    
    const summaryData = parsedData.reduce((acc, row) => {
        acc.grossRevenue += row.subtotal;
        acc.totalDiscount += row.discount;
        acc.totalFee += row.fee;
        acc.netRevenue += row.net_total;
        
        const mappedProduct = skuToProductMap[row.sku];
        const cost = mappedProduct?.cost || 0;
        acc.totalCogs += cost * row.qty;

        return acc;
    }, {
        grossRevenue: 0,
        totalDiscount: 0,
        totalFee: 0,
        netRevenue: 0,
        totalCogs: 0,
    });
    
    summaryData.netProfit = summaryData.netRevenue - summaryData.totalCogs;


    return { 
      allProductsMapped: unmapped.length === 0, 
      uniqueOrderCount: uniqueOrders.size,
      totalItems,
      unmappedSkus: unmapped,
      summary: summaryData
    };
  }, [parsedData, skuToProductMap]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({ title: "File tidak valid", description: "Mohon unggah file dengan format .xlsx, .xls atau .csv", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      setParsedData([]); // Reset preview on new file
      setSkuToProductMap({});
    }
  };
  
 const normalizeNumber = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
        const cleanedValue = value.trim().replace(/[^0-9,.-]+/g, '').replace(',', '.');
        if (cleanedValue === '' || cleanedValue === '-' || cleanedValue === '.') return 0;
        const num = parseFloat(cleanedValue);
        return isNaN(num) ? 0 : num;
    }
    return 0;
  }
  
  const handleParse = () => {
    if (!file) {
      toast({ title: "File belum dipilih", description: "Pilih file laporan penjualan terlebih dahulu.", variant: "destructive" });
      return;
    }

    startParsing(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

                if (json.length < 2) throw new Error("File tidak berisi data yang cukup.");
                
                const header = json[0].map(h => String(h).toLowerCase().trim());
                const dataRows = json.slice(1);
                
                let currentSkuMap: Record<string, Product | null> = {};
                
                const processedOrders = new Set<string>();

                const mappedData: ImportRow[] = dataRows.map((row, rowIndex) => {
                    const rowData: {[key: string]: any} = {};
                    header.forEach((h, index) => {
                        rowData[h] = row[index];
                    });
                    
                    const getVal = (keys: string[]) => {
                        for (const key of keys) {
                            if(rowData[key] !== undefined) return rowData[key];
                        }
                        return undefined;
                    }

                    const tanggal_order_raw = getVal(['waktu pembuatan pesanan', 'tanggal order']);
                    const nomor_order = String(getVal(['nomor pesanan', 'order id', 'no. pesanan']) || '');
                    const channel = String(getVal(['marketplace', 'channel']) || 'N/A');
                    const nama_pembeli = String(getVal(['nama penerima', 'nama pembeli']) || 'N/A');
                    const alamat_lengkap = String(getVal(['alamat pengiriman', 'alamat']) || '');
                    const sku = String(getVal(['sku penjual', 'sku induk', 'sku gudang']) || '');
                    const nama_produk = String(getVal(['nama produk', 'product name']) || '');
                    const qty = normalizeNumber(getVal(['jumlah', 'jumlah produk dibeli', 'kuantitas']));
                    
                    const subtotal_produk = normalizeNumber(getVal(['subtotal produk', 'total penjualan (rp)', 'harga setelah diskon penjual']));

                    const unit_price = qty > 0 ? subtotal_produk / qty : 0;
                    const subtotal = subtotal_produk;

                    const cost = normalizeNumber(getVal(['harga modal', 'harga pokok']));

                    let fee = 0;
                    let discount = 0;
                    let net_total = 0;

                    const channelLower = channel.toLowerCase();
                    
                    if (channelLower.includes('tiktok')) {
                        fee = (subtotal * 0.15) + 1250;
                        net_total = subtotal - fee;
                        discount = 0; 
                    } else { // Shopee and others
                        const commissionFee = normalizeNumber(getVal(['biaya komisi']));
                        const transactionFee = normalizeNumber(getVal(['biaya transaksi']));
                        const affiliateFee = normalizeNumber(getVal(['biaya afiliasi']));
                        let processingFee = 0;
                        
                        if (!processedOrders.has(nomor_order)) {
                           processingFee = normalizeNumber(getVal(['biaya pengolahan', 'biaya pengelolaan']));
                           processedOrders.add(nomor_order);
                        }

                        fee = commissionFee + transactionFee + affiliateFee + processingFee;
                        
                        if (channelLower.includes('shopee')) {
                            discount = normalizeNumber(getVal(['diskon dari penjual', 'voucher dari seller', 'voucher toko']));
                        } else {
                            discount = normalizeNumber(getVal(['diskon dari penjual', 'voucher dari seller', 'voucher toko']));
                        }
                        
                        net_total = subtotal - fee - discount;
                    }
                    
                    let parsedDate;
                    if (tanggal_order_raw instanceof Date) {
                      parsedDate = tanggal_order_raw;
                    } else if (typeof tanggal_order_raw === 'string') {
                      parsedDate = new Date(tanggal_order_raw.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
                    } else {
                      parsedDate = new Date();
                    }
                    const tanggal_order_formatted = !isNaN(parsedDate.getTime()) ? format(parsedDate, 'yyyy-MM-dd HH:mm:ss') : format(new Date(), 'yyyy-MM-dd HH:mm:ss');
                    
                    if (sku && currentSkuMap[sku] === undefined) {
                        const existingMapping = skuMappings.find(m => m.marketplaceSku.trim().toLowerCase() === sku.trim().toLowerCase());
                        if (existingMapping) {
                            currentSkuMap[sku] = products.find(p => p.id === existingMapping.productId) || null;
                        } else {
                            currentSkuMap[sku] = products.find(p => p.sku && sku && p.sku.trim().toLowerCase() === sku.trim().toLowerCase()) || null;
                        }
                    }

                    return {
                        id: `${nomor_order}-${rowIndex}`,
                        tanggal_order: tanggal_order_formatted,
                        nomor_order, channel, nama_pembeli, alamat_lengkap, sku, nama_produk, qty, unit_price,
                        cost, subtotal, shipping: 0, fee, discount, net_total,
                        mappedProduct: null
                    };
                }).filter(row => row.nomor_order && row.sku);

                setParsedData(mappedData);
                setSkuToProductMap(currentSkuMap);
                toast({ title: 'Berhasil', description: `${mappedData.length} baris berhasil di-parse.` });

            } catch (err) {
                 const e = err as Error;
                 toast({ title: 'Gagal Parse File', description: `Format file tidak sesuai atau rusak. Error: ${e.message}`, variant: 'destructive' });
            }
        }
        reader.readAsArrayBuffer(file);
    });
  };

  const handleProductMapping = async (sku: string, channel: string, product: Product | null) => {
    setSkuToProductMap(prevMap => ({
        ...prevMap,
        [sku]: product
    }));

    if (product) {
      // Save mapping to Firestore
      await addOrUpdateSkuMapping({
        marketplaceSku: sku,
        channel: channel,
        productId: product.id,
        productName: product.name
      });
      toast({ title: "Mapping Disimpan", description: `SKU ${sku} dipetakan ke ${product.name}.` });
    }
  };

  const handleImport = () => {
    if (!allProductsMapped) {
        toast({ title: 'Pemetaan Belum Selesai', description: 'Harap petakan semua produk yang tidak ditemukan sebelum mengimpor.', variant: 'destructive' });
        return;
    }

    const dataToImport = parsedData.map(row => ({
        ...row,
        mappedProduct: skuToProductMap[row.sku]
    }));

    startImporting(async () => {
        setImportProgress(0);
        const CHUNK_SIZE = 50; 
        const totalChunks = Math.ceil(dataToImport.length / CHUNK_SIZE);
        let importedOrderCount = 0;

        for (let i = 0; i < totalChunks; i++) {
            const chunk = dataToImport.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const result = await importMarketplaceTransactionsInChunks(chunk);

            if (result.error) {
                toast({ title: `Gagal Mengimpor (Bagian ${i + 1}/${totalChunks})`, description: result.error, variant: 'destructive' });
                setImportProgress(0); // Reset progress on error
                return;
            }
            
            if (result.importedCount) {
                importedOrderCount += result.importedCount;
            }

            setImportProgress(((i + 1) / totalChunks) * 100);
        }

        toast({ title: 'Impor Selesai!', description: `${importedOrderCount} pesanan berhasil diimpor dan dijurnal.` });
        setTimeout(() => router.push('/transactions'), 1000);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Impor Penjualan dari Marketplace</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Langkah 1: Unggah Laporan Penjualan</CardTitle>
          <CardDescription>Pilih dan unggah file laporan penjualan (.xlsx atau .csv) yang Anda unduh dari seller center.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <Button variant="outline" className="w-full md:w-auto justify-start" onClick={() => fileInputRef.current?.click()}>
                    <File className="mr-2 h-4 w-4" />
                    {file ? file.name : 'Pilih file...'}
                </Button>
                <p className="text-sm text-muted-foreground">Lalu</p>
                 <Button onClick={handleParse} disabled={isParsing || !file} className="w-full md:w-auto">
                    {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Proses dan Tampilkan Pratinjau
                </Button>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
            />
        </CardContent>
      </Card>

      {parsedData.length > 0 && (
        <>
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle>Ringkasan Impor</CardTitle>
                  <CardDescription>Berikut adalah ringkasan finansial dari data yang akan diimpor.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <SummaryItem icon={DollarSign} label="Pendapatan Kotor" value={summary.grossRevenue} />
                    <SummaryItem icon={TrendingDown} label="Total Diskon & Biaya" value={summary.totalDiscount + summary.totalFee} isNegative />
                    <SummaryItem icon={Wallet} label="Pendapatan Bersih" value={summary.netRevenue} />
                    <SummaryItem icon={Wallet} label="Estimasi HPP" value={summary.totalCogs} isNegative />
                    <SummaryItem icon={Landmark} label="Estimasi Laba Bersih" value={summary.netProfit} isProfit />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Langkah 2: Pratinjau & Pemetaan</CardTitle>
                    <CardDescription>
                      Periksa data yang berhasil di-parse dan petakan produk yang belum ditemukan. SKU di laporan harus cocok dengan SKU Gudang di data produk.
                      <br />
                      <span className="font-semibold text-foreground">
                        Terdeteksi {uniqueOrderCount} transaksi unik dengan total {totalItems} item.
                      </span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {unmappedSkus.length > 0 && (
                        <div className="mb-6">
                            <Alert variant="destructive" className="mb-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Diperlukan Pemetaan</AlertTitle>
                                <AlertDescription>
                                    {unmappedSkus.length} SKU dari laporan tidak dapat ditemukan di database produk Anda. Harap petakan secara manual di bawah ini.
                                </AlertDescription>
                            </Alert>
                            <div className="max-h-[300px] overflow-y-auto border rounded-md p-4 space-y-4">
                                {unmappedSkus.map(sku => (
                                    <div key={sku} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                        <div>
                                            <p className="text-sm font-semibold">SKU Laporan:</p>
                                            <p className="text-sm text-muted-foreground">{sku}</p>
                                        </div>
                                        <ProductMappingCell
                                            sku={sku}
                                            channel={parsedData.find(d => d.sku === sku)?.channel || 'unknown'}
                                            mappedProduct={skuToProductMap[sku]}
                                            allProducts={products}
                                            onMap={(p) => handleProductMapping(sku, parsedData.find(d => d.sku === sku)?.channel || 'unknown', p)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardContent>
                    <div className="max-h-[500px] overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted">
                               <TableRow>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Produk Terpetakan</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                    <TableHead className="text-right">Diskon</TableHead>
                                    <TableHead className="text-right">Fee</TableHead>
                                    <TableHead className="text-right">Total Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedData.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                          <Badge variant="secondary">{row.channel}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">{row.sku}</TableCell>
                                        <TableCell>
                                            <ProductMappingCell
                                                sku={row.sku}
                                                channel={row.channel}
                                                mappedProduct={skuToProductMap[row.sku]}
                                                allProducts={products}
                                                onMap={(p) => handleProductMapping(row.sku, row.channel, p)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">{row.qty}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {Math.round(row.subtotal).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-destructive">
                                            - {Math.round(row.discount).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-destructive">
                                            - {Math.round(row.fee).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono">
                                            Rp {Math.round(row.net_total).toLocaleString('id-ID')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                     {!allProductsMapped && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Pemetaan Belum Selesai</AlertTitle>
                            <AlertDescription>
                                Harap petakan semua produk yang tidak ditemukan sebelum mengimpor.
                            </AlertDescription>
                        </Alert>
                     )}
                     {isImporting && (
                        <div className="w-full space-y-2">
                            <Progress value={importProgress} />
                            <p className="text-sm text-muted-foreground">Mengimpor data... {Math.round(importProgress)}%</p>
                        </div>
                     )}
                    <Button onClick={handleImport} disabled={isImporting || !allProductsMapped}>
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                        Impor {parsedData.length} Baris
                    </Button>
                </CardFooter>
            </Card>
        </>
      )}

    </div>
  );
}


function ProductMappingCell({ sku, channel, mappedProduct, allProducts, onMap }: { sku: string; channel: string, mappedProduct: Product | null | undefined, allProducts: Product[], onMap: (p: Product | null) => void }) {
    const [open, setOpen] = useState(false);

    if (mappedProduct) {
        return (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="mr-1 h-3 w-3" />
                {mappedProduct.name}
            </Badge>
        );
    }
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="w-full justify-between text-destructive">
                    Pilih Produk...
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Cari produk..." />
                    <CommandList>
                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {allProducts.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    value={p.name}
                                    onSelect={() => {
                                        onMap(p);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                    {p.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const SummaryItem = ({ icon: Icon, label, value, isNegative = false, isProfit = false }: { icon: React.ElementType, label: string, value: number, isNegative?: boolean, isProfit?: boolean }) => {
  const valueColor = isProfit ? (value >= 0 ? 'text-green-600' : 'text-destructive') : (isNegative ? 'text-destructive' : 'text-foreground');
  
  return (
    <div className="flex items-start gap-4 rounded-lg bg-muted/50 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border">
            <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      <div className="space-y-1">
        <p className="text-muted-foreground">{label}</p>
        <p className={cn('text-xl font-bold font-mono', valueColor)}>
          {isNegative ? '- ' : ''}Rp {Math.round(Math.abs(value)).toLocaleString('id-ID')}
        </p>
      </div>
    </div>
  )
};

    