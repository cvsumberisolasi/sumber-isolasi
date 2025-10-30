
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Archive, DollarSign, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';


export default function StockReportsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Product)));
      setLoading(false);
    });

    const qCategories = query(collection(db, 'productCategories'), orderBy('name'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)))
    });


    return () => {
        unsubscribeProducts();
        unsubscribeCategories();
    };
  }, []);

  const categoryOptions = useMemo(() => {
    return ['all', ...categories.map(c => c.name)];
  }, [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(filter.toLowerCase());
      const categoryMatch = categoryFilter === 'all' || p.category === categoryFilter;
      return nameMatch && categoryMatch;
    });
  }, [products, filter, categoryFilter]);

  const totalInventoryValue = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + (p.cost || 0) * p.stock, 0);
  }, [filteredProducts]);
  
  const totalStockCount = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  }, [filteredProducts]);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    autoTable(doc, {
        headStyles: { fillColor: [15, 23, 42] },
        styles: { font: 'helvetica' },
    });
    const settings = await getCompanySettings();
    const companyName = settings.companyName || 'Toko Kilat';
    const period = `Per tanggal: ${format(new Date(), 'd MMMM yyyy', { locale: id })}`;
    
    let y = 15;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 105, y, { align: 'center' });
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Stok', 105, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text(period, 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Ringkasan Persediaan", 14, y);
    y+= 6;
    autoTable(doc, {
        startY: y,
        body: [
            ['Total Nilai Persediaan', `Rp ${totalInventoryValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
            ['Total Unit Persediaan', `${totalStockCount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
        ],
        theme: 'grid',
    });

    y = (doc as any).autoTable.previous.finalY + 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Rincian Nilai Persediaan", 14, y);
    y += 6;

    const tableData = filteredProducts.map(p => [
      p.name,
      p.category,
      p.stock.toLocaleString('id-ID', { maximumFractionDigits: 0 }),
      `Rp ${(p.cost || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
      `Rp ${((p.cost || 0) * p.stock).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Produk', 'Kategori', 'Stok', 'Harga Pokok', 'Total Nilai']],
        body: tableData,
        theme: 'striped',
        styles: { cellPadding: 2, fontSize: 8 },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        }
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dicetak pada ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, doc.internal.pageSize.getHeight() - 10);
    
    doc.save(`laporan-stok-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Dialog onOpenChange={(open) => !open && setSelectedProduct(null)}>
      <div className="flex flex-col gap-6">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-headline font-bold">Laporan Stok</h1>
          <Button onClick={handleExportPDF} variant="outline" className="w-full sm:w-auto" disabled={loading}>
              <Download className="mr-2 h-4 w-4"/>
              Ekspor PDF
          </Button>
        </div>
        
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Nilai Persediaan</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">Rp {totalInventoryValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">Berdasarkan harga pokok produk</p>
              </CardContent>
              </Card>
              <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Unit Persediaan</CardTitle>
                  <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{totalStockCount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">Jumlah semua item di gudang</p>
              </CardContent>
              </Card>
          </div>

          <Card>
              <CardHeader>
              <CardTitle>Rincian Nilai Persediaan</CardTitle>
              <CardDescription>Daftar semua produk beserta stok dan nilainya saat ini.</CardDescription>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Input
                      placeholder="Cari nama produk..."
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="w-full sm:max-w-sm"
                  />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter kategori" />
                      </SelectTrigger>
                      <SelectContent>
                      {categoryOptions.map(cat => (
                          <SelectItem key={cat} value={cat}>
                          {cat === 'all' ? 'Semua Kategori' : cat}
                          </SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
                  </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                        <TableHead className="text-right">Harga Pokok</TableHead>
                        <TableHead className="text-right">Total Nilai</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-24">Tidak ada produk ditemukan.</TableCell></TableRow>
                    ) : (
                        filteredProducts.map(p => (
                        <TableRow key={p.id}>
                            <TableCell>
                                <DialogTrigger asChild>
                                <Button variant="link" className="p-0 h-auto font-medium" onClick={() => setSelectedProduct(p)}>
                                    {p.name}
                                </Button>
                                </DialogTrigger>
                            </TableCell>
                            <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                            <TableCell className="text-right font-mono">{p.stock}</TableCell>
                            <TableCell className="text-right font-mono">Rp {(p.cost || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                            <TableCell className="text-right font-bold font-mono">Rp {((p.cost || 0) * p.stock).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                    </Table>
                </div>
              </CardContent>
          </Card>
        </div>
      </div>
      {selectedProduct && (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Detail Produk: {selectedProduct.name}</DialogTitle>
                <DialogDescription>SKU: {selectedProduct.sku || 'N/A'}</DialogDescription>
            </DialogHeader>
            <div className="text-sm">
                <p><strong>Stok Saat Ini:</strong> {selectedProduct.stock} {selectedProduct.baseUnit}</p>
                <p><strong>Harga Pokok:</strong> Rp {(selectedProduct.cost || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                <p className="font-semibold mt-4">Satuan Jual:</p>
                <ul>
                    {selectedProduct.units.map(u => (
                        <li key={u.name}>- {u.name} (1 = {u.conversionRate} {selectedProduct.baseUnit}): Rp {u.price.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</li>
                    ))}
                </ul>
                <p className="mt-4 text-center text-muted-foreground">Riwayat pergerakan stok belum tersedia.</p>
            </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
