
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BillOfMaterial, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BomFormDialog } from '@/components/production/bom-form-dialog';
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
import { deleteBillOfMaterial } from '../actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


export default function BillOfMaterialsPage() {
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bomUnsub = onSnapshot(query(collection(db, "billOfMaterials"), orderBy("productName")), (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BillOfMaterial)));
      setLoading(false);
    });

    const productsUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      bomUnsub();
      productsUnsub();
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Formula Produksi (Bill of Materials)</h1>
        <BomFormDialog products={products}>
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Buat Formula Baru
            </Button>
        </BomFormDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Formula Produksi</CardTitle>
          <CardDescription>Resep untuk memproduksi barang jadi dari bahan baku.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk Jadi</TableHead>
                <TableHead>Jumlah Bahan</TableHead>
                <TableHead>Total Biaya Bahan Baku</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : boms.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Belum ada formula produksi.</TableCell></TableRow>
              ) : (
                boms.map(bom => <BomRow key={bom.id} bom={bom} products={products} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


function BomRow({ bom, products }: { bom: BillOfMaterial, products: Product[] }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const totalCost = bom.items.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + (product?.cost || 0) * item.quantity;
    }, 0);

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteBillOfMaterial(bom.id);
            if(result.error) {
                toast({ title: "Gagal menghapus", description: result.error, variant: 'destructive'});
            } else {
                toast({ title: "Berhasil", description: `Formula untuk ${bom.productName} telah dihapus.`});
            }
        });
    };

    return (
        <TableRow>
            <TableCell className="font-medium">{bom.productName} <Badge variant="outline">x{bom.quantityProduced}</Badge></TableCell>
            <TableCell>{bom.items.length} bahan</TableCell>
            <TableCell>Rp {totalCost.toLocaleString('id-ID')}</TableCell>
            <TableCell className="text-right">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Buka menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         <BomFormDialog bom={bom} products={products}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                        </BomFormDialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tindakan ini akan menghapus formula produksi untuk <strong>{bom.productName}</strong> secara permanen.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Ya, Hapus'}
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

