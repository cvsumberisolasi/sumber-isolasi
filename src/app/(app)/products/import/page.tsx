

'use client';

import React, { useState, useTransition, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, UploadCloud, Loader2, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { batchImportProducts } from '../actions';
import type { NewProduct } from '@/lib/types';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const HEADER_MAP: Record<string, keyof NewProduct | 'hargaJual'> = {
  'nama produk': 'name',
  'sku': 'sku',
  'kategori': 'category',
  'stok': 'stock',
  'harga pokok': 'cost',
  'satuan dasar': 'baseUnit',
  'harga jual (satuan dasar)': 'hargaJual',
  'batas stok minimum': 'minStockThreshold',
};

export default function ImportProductsPage() {
  const [isPending, startTransition] = useTransition();
  const [parsedData, setParsedData] = useState<NewProduct[]>([]);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        setError('');
        setParsedData([]);
        handleParse(selectedFile);
    }
  };

  const handleParse = (fileToParse: File) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 2) {
                throw new Error("File tidak berisi data.");
            }

            const header = json[0].map(h => String(h).trim().toLowerCase());
            const dataRows = json.slice(1);
            
            const requiredHeaders = ['nama produk', 'harga jual (satuan dasar)', 'stok', 'harga pokok', 'satuan dasar', 'batas stok minimum'];
            
            const missingHeaders = requiredHeaders.filter(rh => !header.includes(rh));
            if (missingHeaders.length > 0) {
                 throw new Error(`Header kolom wajib tidak ditemukan: ${missingHeaders.join(', ')}.`);
            }
            
            const products: NewProduct[] = dataRows.map(rowArr => {
                let product: any = { units: [] };
                let rowHargaJual = 0;

                header.forEach((h, index) => {
                    const key = HEADER_MAP[h];
                    const value = rowArr[index];

                    if (key) {
                        if (key === 'hargaJual') {
                            rowHargaJual = Number(value) || 0;
                        } else if (key === 'stock' || key === 'cost' || key === 'minStockThreshold') {
                            product[key] = Number(value) || 0;
                        } else {
                            product[key] = value;
                        }
                    }
                });

                const baseUnitName = product.baseUnit || 'Pcs';
                product.baseUnit = baseUnitName;

                product.units.push({
                    name: baseUnitName,
                    price: rowHargaJual,
                    cost: product.cost,
                    conversionRate: 1,
                });
                
                if (!product.minStockThreshold) {
                  product.minStockThreshold = 10; // Default value
                }

                if (!product.name) throw new Error("Nama produk tidak boleh kosong di salah satu baris.");

                return product as NewProduct;
            }).filter(p => p.name); // Filter out rows that might be empty

            setParsedData(products);
            toast({ title: "File Berhasil Diproses", description: `${products.length} baris data siap untuk diimpor.`});

        } catch (err: any) {
            setError(`Gagal mem-parsing file: ${err.message}`);
            setParsedData([]);
            setFile(null);
        }
    };
    reader.readAsBinaryString(fileToParse);
  };
  
  const handleImport = () => {
    if (parsedData.length === 0) {
      toast({ title: "Tidak ada data untuk diimpor", variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await batchImportProducts(parsedData);
      if (result.error) {
        toast({ title: "Gagal Mengimpor", description: result.error, variant: 'destructive'});
      } else {
        toast({ title: "Impor Berhasil", description: `${parsedData.length} produk telah berhasil ditambahkan.`});
        router.push('/products');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Impor Data Produk</h1>
      <Card>
        <CardHeader>
          <CardTitle>1. Unggah File Anda</CardTitle>
          <CardDescription>
            Pilih file spreadsheet (Excel, CSV) dari komputer Anda. Pastikan baris pertama adalah header yang sesuai.
            Header wajib: Nama Produk, SKU, Kategori, Stok, Harga Pokok, Satuan Dasar, Harga Jual (Satuan Dasar), Batas Stok Minimum.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" /> 
                {file ? `Menggunakan: ${file.name}` : 'Pilih File Excel atau CSV'}
           </Button>
           <input
             type="file"
             ref={fileInputRef}
             className="hidden"
             accept=".xlsx, .xls, .csv"
             onChange={handleFileChange}
           />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {parsedData.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>2. Pratinjau & Konfirmasi Data</CardTitle>
                <CardDescription>
                    Berikut adalah data yang berhasil diproses dari file Anda. Periksa kembali sebelum melakukan impor.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-[400px] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                            <TableRow>
                                <TableHead>Nama Produk</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Stok</TableHead>
                                <TableHead className="text-right">Harga Pokok</TableHead>
                                <TableHead>Satuan Dasar</TableHead>
                                <TableHead className="text-right">Harga Jual</TableHead>
                                <TableHead className="text-right">Batas Min.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedData.map((product, index) => (
                                <TableRow key={index}>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>{product.sku}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.stock}</TableCell>
                                    <TableCell className="text-right">{(product.cost || 0).toLocaleString('id-ID')}</TableCell>
                                    <TableCell>{product.baseUnit}</TableCell>
                                    <TableCell className="text-right">{(product.units[0]?.price || 0).toLocaleString('id-ID')}</TableCell>
                                    <TableCell className="text-right">{product.minStockThreshold}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Perhatian</AlertTitle>
                    <AlertDescription>
                        Impor ini akan menggunakan satuan dasar dari kolom "Satuan Dasar". Anda dapat menambahkan satuan lain nanti melalui menu edit produk.
                    </AlertDescription>
                </Alert>
                <Button onClick={handleImport} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                    Impor {parsedData.length} Produk
                </Button>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}

    

    


