
'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Edit, Plus, ChevronsUpDown, Check } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SkuMapping, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { addOrUpdateSkuMapping, deleteSkuMapping } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';


export default function SkuMappingPage() {
    const [mappings, setMappings] = useState<SkuMapping[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubMappings = onSnapshot(query(collection(db, 'skuMappings'), orderBy('marketplaceSku')), (snapshot) => {
            setMappings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SkuMapping)));
            setLoading(false);
        });

        const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });

        return () => {
            unsubMappings();
            unsubProducts();
        };
    }, []);

    const filteredMappings = useMemo(() => {
        return mappings.filter(m => 
            m.marketplaceSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [mappings, searchTerm]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-headline font-bold">Pemetaan SKU Marketplace</h2>
                 <MappingFormDialog products={products}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4"/> Tambah Mapping Baru
                    </Button>
                </MappingFormDialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Pemetaan SKU</CardTitle>
                    <CardDescription>
                        Kelola SKU dari marketplace yang telah dipetakan ke produk internal Anda untuk otomatisasi impor.
                    </CardDescription>
                    <div className="pt-4">
                        <Input 
                            placeholder="Cari SKU atau nama produk..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU Marketplace</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead>Produk Internal</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin"/></TableCell></TableRow>
                            ) : filteredMappings.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Belum ada data mapping.</TableCell></TableRow>
                            ) : (
                                filteredMappings.map(mapping => (
                                    <MappingRow key={mapping.id} mapping={mapping} products={products} />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}


function MappingRow({ mapping, products }: { mapping: SkuMapping, products: Product[] }) {
    const [isDeleting, startDeleteTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startDeleteTransition(async () => {
            const result = await deleteSkuMapping(mapping.id);
            if (result.error) {
                toast({ title: "Gagal Menghapus", description: result.error, variant: 'destructive'});
            } else {
                toast({ title: "Berhasil", description: `Mapping untuk ${mapping.marketplaceSku} telah dihapus.`});
            }
        });
    }

    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{mapping.marketplaceSku}</TableCell>
            <TableCell><Badge variant="secondary">{mapping.channel}</Badge></TableCell>
            <TableCell className="font-medium">{mapping.productName}</TableCell>
            <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                    <MappingFormDialog mapping={mapping} products={products}>
                        <Button variant="outline" size="sm"><Edit className="mr-2 h-4 w-4"/> Edit</Button>
                    </MappingFormDialog>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/> Hapus</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ini akan menghapus pemetaan untuk SKU <strong>{mapping.marketplaceSku}</strong> secara permanen.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                             <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Ya, Hapus'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    )
}

function MappingFormDialog({ children, mapping, products }: { children: React.ReactNode, mapping?: SkuMapping, products: Product[]}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const [marketplaceSku, setMarketplaceSku] = useState(mapping?.marketplaceSku || '');
    const [channel, setChannel] = useState(mapping?.channel || '');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const isEditing = !!mapping;

    useEffect(() => {
        if(open) {
            setMarketplaceSku(mapping?.marketplaceSku || '');
            setChannel(mapping?.channel || 'unknown');
            if (mapping?.productId) {
                setSelectedProduct(products.find(p => p.id === mapping.productId) || null);
            } else {
                setSelectedProduct(null);
            }
        }
    }, [open, mapping, products]);

    const handleSubmit = () => {
        if (!marketplaceSku || !selectedProduct) {
            toast({ title: "Data tidak lengkap", description: "SKU dan produk internal harus diisi.", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            const result = await addOrUpdateSkuMapping({
                id: mapping?.id,
                marketplaceSku,
                channel,
                productId: selectedProduct.id,
                productName: selectedProduct.name,
            });

            if (result.error) {
                toast({ title: 'Gagal Menyimpan', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Berhasil', description: 'Pemetaan SKU berhasil disimpan.' });
                setOpen(false);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit' : 'Buat'} Pemetaan SKU</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="sku">SKU Marketplace</Label>
                        <Input id="sku" value={marketplaceSku} onChange={(e) => setMarketplaceSku(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="channel">Channel / Marketplace</Label>
                        <Input id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Contoh: Shopee, Tokopedia, TikTok"/>
                    </div>
                     <div className="space-y-2">
                        <Label>Produk Internal</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                    {selectedProduct ? selectedProduct.name : "Pilih produk..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Cari produk..." />
                                    <CommandList>
                                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                        <CommandGroup>
                                            {products.map((p) => (
                                                <CommandItem key={p.id} value={p.name} onSelect={() => setSelectedProduct(p)}>
                                                    <Check className={cn("mr-2 h-4 w-4", selectedProduct?.id === p.id ? "opacity-100" : "opacity-0")} />
                                                    {p.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={isPending || !marketplaceSku || !selectedProduct}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

