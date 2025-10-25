
'use client';

import React from 'react';
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';


export default function WorkOrderPage() {
  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Perintah Produksi (Work Order)</h1>
            <Button disabled>
                <Plus className="mr-2 h-4 w-4" /> Buat Perintah Baru
            </Button>
        </div>
         <PlaceholderPage
            title="Daftar Perintah Produksi"
            description="Fitur ini sedang dalam pengembangan. Di sini Anda akan dapat membuat perintah untuk memulai proses produksi berdasarkan formula yang telah dibuat."
        />
    </div>
  );
}
