
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';

// Placeholder data and functions until backend is implemented
const getMappings = async () => {
    // In a real app, this would fetch from Firestore
    return [
        { id: '1', marketplaceSku: 'TK-001-A', productId: 'prod_1', productName: 'Baju Anak Merah' },
        { id: '2', marketplaceSku: 'SHP-XYZ-02', productId: 'prod_2', productName: 'Celana Jeans Biru' },
    ];
};

const deleteMapping = async (id: string) => {
    // In a real app, this would delete from Firestore
    console.log(`Deleting mapping ${id}`);
    return { success: true };
}


export default function ImportMappingHistoryPage() {
    const [mappings, setMappings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const data = await getMappings();
            setMappings(data);
            setLoading(false);
        }
        loadData();
    }, []);

    const filteredMappings = useMemo(() => {
        return mappings.filter(m => 
            m.marketplaceSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [mappings, searchTerm]);

    const handleDelete = async (id: string) => {
        if (!confirm('Anda yakin ingin menghapus mapping ini?')) return;
        
        await deleteMapping(id);
        setMappings(prev => prev.filter(m => m.id !== id));
    };

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-xl md:text-2xl font-headline font-bold">Riwayat Mapping SKU Marketplace</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Pemetaan SKU</CardTitle>
                    <CardDescription>
                        Kelola SKU dari marketplace yang telah dipetakan ke produk internal Anda.
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
                                <TableHead>Produk Internal</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="animate-spin"/></TableCell></TableRow>
                            ) : filteredMappings.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Belum ada data mapping.</TableCell></TableRow>
                            ) : (
                                filteredMappings.map(mapping => (
                                    <TableRow key={mapping.id}>
                                        <TableCell className="font-mono text-xs">{mapping.marketplaceSku}</TableCell>
                                        <TableCell className="font-medium">{mapping.productName}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(mapping.id)}>
                                                <Trash2 className="mr-2 h-4 w-4"/> Hapus
                                            </Button>
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

