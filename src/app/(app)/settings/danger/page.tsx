
'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteSingleCollection, resetAllProductStock, deleteCashInJournals, deleteCashOutJournals, deleteCashTransferJournals } from './actions';
import { Loader2, Trash2, AlertTriangle, KeyRound, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ALL_COLLECTIONS = [
    { name: "transactions", group: 'Transaksional', description: 'Semua riwayat penjualan. Menghapus ini akan mengembalikan stok produk yang terjual.' },
    { name: "journals", group: 'Transaksional', description: 'SEMUA entri jurnal akuntansi. Hapus ini jika Anda ingin mengulang seluruh pembukuan.' },
    { name: "salesReturns", group: 'Transaksional', description: 'Semua riwayat retur penjualan. Menghapus ini akan mengurangi stok produk yang diretur.' },
    { name: "parkedTransactions", group: 'Transaksional', description: 'Semua transaksi kasir yang diparkir.' },
    { name: "purchaseRequests", group: 'Transaksional', description: 'Semua permintaan pembelian.' },
    { name: "purchaseOrders", group: 'Transaksional', description: 'Semua pesanan pembelian (PO).' },
    { name: "goodsReceipts", group: 'Transaksional', description: 'Semua penerimaan barang (GRN). Menghapus ini akan mengurangi stok produk yang diterima.' },
    { name: "supplierInvoices", group: 'Transaksional', description: 'Semua faktur dari pemasok.' },
    { name: "purchasePayments", group: 'Transaksional', description: 'Semua pembayaran utang.' },
    { name: "purchaseReturns", group: 'Transaksional', description: 'Semua riwayat retur pembelian. Menghapus ini akan mengembalikan stok produk yang diretur.' },
    { name: "stockTransfers", group: 'Transaksional', description: 'Semua riwayat transfer stok (tidak memengaruhi total stok).' },
    { name: "periodClosings", group: 'Transaksional', description: 'Semua riwayat tutup buku.' },
    { name: "stockOpnames", group: 'Transaksional', description: 'Semua riwayat stock opname. Menghapus ini akan mengembalikan stok ke sebelum opname.' },
    { name: "billOfMaterials", group: 'Produksi', description: 'Semua formula produksi (BOM).' },
    { name: "workOrders", group: 'Produksi', description: 'Semua perintah kerja produksi (WO).' },
    { name: "productionCompletions", group: 'Produksi', description: 'Semua riwayat penyelesaian produksi.' },
    { name: "products", group: 'Master', description: 'Semua data produk. Perhatian: Menghapus ini akan menyebabkan error pada data transaksi lama.' },
    { name: "customers", group: 'Master', description: 'Semua data pelanggan.' },
    { name: "suppliers", group: 'Master', description: 'Semua data pemasok.' },
    { name: "productCategories", group: 'Master', description: 'Semua kategori produk.' },
    { name: "warehouses", group: 'Master', description: 'Semua data gudang.' },
    { name: "taxes", group: 'Master', description: 'Semua tarif pajak.' },
    { name: "currencies", group: 'Master', description: 'Semua data mata uang.' },
    { name: "marketplaceStores", group: 'Master', description: 'Semua pengaturan toko marketplace.' },
    { name: "coa", group: 'Akuntansi', description: 'Seluruh Bagan Akun (Chart of Accounts).' },
];

interface DeleteActionProps {
  collection: { name: string; group: string; description: string };
}

function SpecificDeleteAction({ action, name, description }: { action: () => Promise<any>, name: string, description: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleConfirm = () => {
        startTransition(async () => {
            const result = await action();
            if (result.error) {
                toast({ title: 'Gagal Menghapus Data', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Berhasil', description: `Data "${name}" telah berhasil dihapus.` });
            }
        });
    };

    return (
        <TableRow>
            <TableCell><Badge variant="secondary" className="font-mono">{name}</Badge></TableCell>
            <TableCell>{description}</TableCell>
            <TableCell>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Data "{name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tindakan ini tidak dapat diurungkan. Ini akan menghapus semua data terkait <code className="bg-muted px-1 rounded-sm">{name}</code> secara permanen.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirm} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Ya, Hapus Data
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TableCell>
        </TableRow>
    )
}

function DeleteAction({ collection }: DeleteActionProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteSingleCollection(collection.name);
      if (result.error) {
        toast({ title: 'Gagal Menghapus Data', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: `Koleksi data "${collection.name}" telah berhasil dihapus.` });
      }
    });
  };

  return (
    <TableRow>
        <TableCell><Badge variant="secondary" className="font-mono">{collection.name}</Badge></TableCell>
        <TableCell>{collection.description}</TableCell>
        <TableCell>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Koleksi Data "{collection.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tindakan ini tidak dapat diurungkan. Ini akan menghapus semua dokumen di dalam koleksi <code className="bg-muted px-1 rounded-sm">{collection.name}</code> secara permanen.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ya, Hapus Koleksi
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableCell>
    </TableRow>
  );
}

function ResetStockAction() {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleConfirm = () => {
        startTransition(async () => {
            const result = await resetAllProductStock();
            if (result.error) {
                toast({ title: 'Gagal Mereset Stok', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Berhasil', description: 'Stok semua produk telah direset menjadi 0.' });
            }
        });
    }

    return (
        <TableRow>
            <TableCell><Badge variant="outline" className="font-mono">Stok Produk</Badge></TableCell>
            <TableCell>Mengatur ulang (reset) jumlah stok semua produk menjadi 0 tanpa menghapus data produk.</TableCell>
            <TableCell>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reset Stok
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Semua Stok Produk?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan mengubah jumlah stok SEMUA produk Anda menjadi 0.
                            Data produk itu sendiri (nama, harga, dll) tidak akan dihapus. Lanjutkan?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Ya, Reset Stok
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TableCell>
        </TableRow>
    );
}


export default function DangerZonePage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '123qwe') {
      setIsAuthorized(true);
      setError('');
    } else {
      setError('Kata sandi salah. Akses ditolak.');
    }
  };

  if (!isAuthorized) {
    return (
        <div className="flex flex-col gap-6 items-center justify-center h-full">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound/> Autentikasi Diperlukan
                    </CardTitle>
                    <CardDescription>
                        Anda harus memasukkan kata sandi untuk mengakses halaman ini.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Kata Sandi</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full">Masuk</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
  }

  return (
    <Card className="border-destructive">
    <CardHeader>
        <CardTitle className="font-headline text-destructive flex items-center gap-2">
        <AlertTriangle />
        Zona Berbahaya
        </CardTitle>
        <CardDescription>
        Tindakan di area ini bersifat permanen dan tidak dapat diurungkan. Lakukan dengan sangat hati-hati.
        </CardDescription>
    </CardHeader>
    <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Target Data</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Aksi</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <ResetStockAction />
                <SpecificDeleteAction name="Kas Masuk" description="Menghapus semua jurnal dari menu Kas Masuk." action={deleteCashInJournals} />
                <SpecificDeleteAction name="Kas Keluar" description="Menghapus semua jurnal dari menu Kas Keluar." action={deleteCashOutJournals} />
                <SpecificDeleteAction name="Transfer Kas" description="Menghapus semua jurnal dari menu Transfer Antar Kas." action={deleteCashTransferJournals} />
                {ALL_COLLECTIONS.map(collection => (
                    <DeleteAction key={collection.name} collection={collection} />
                ))}
            </TableBody>
        </Table>
    </CardContent>
    </Card>
  );
}
