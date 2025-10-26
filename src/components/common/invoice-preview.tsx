
'use client';

import type { CompanySettings } from '@/app/(app)/settings/actions';
import type { Customer, Transaction } from '@/lib/types';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';

interface InvoicePreviewProps {
  transaction: Transaction;
  companySettings: CompanySettings;
  customer: Customer | null;
}

export function InvoicePreview({ transaction, companySettings, customer }: InvoicePreviewProps) {
  if (!transaction) return null;

  return (
    <div className="p-8 border rounded-lg bg-background">
      <header className="flex justify-between items-start pb-6 border-b">
        <div className="space-y-1">
          {companySettings.logoDataUrl && (
            <Image src={companySettings.logoDataUrl} alt="Company Logo" width={80} height={80} className="object-contain" />
          )}
          <h1 className="text-2xl font-bold font-headline">{companySettings.companyName}</h1>
          <p className="text-sm text-muted-foreground">{companySettings.address}</p>
          <p className="text-sm text-muted-foreground">{companySettings.phone} | {companySettings.email}</p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold font-headline text-primary">INVOICE</h2>
          <p className="font-mono text-sm">#{transaction.id}</p>
          <p className="text-sm">Tanggal: {format(transaction.date, 'dd MMMM yyyy')}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 my-6">
        <div>
          <h3 className="font-semibold mb-1">Ditagihkan Kepada:</h3>
          <p className="font-bold">{customer?.name || transaction.customerName}</p>
          <p className="text-sm text-muted-foreground">{customer?.address}</p>
          <p className="text-sm text-muted-foreground">{customer?.phone}</p>
        </div>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="text-center">Jumlah</TableHead>
            <TableHead className="text-right">Harga Satuan</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transaction.items.map(item => (
            <TableRow key={item.productId}>
              <TableCell>{item.productName}</TableCell>
              <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
              <TableCell className="text-right font-mono">Rp {item.price.toLocaleString('id-ID')}</TableCell>
              <TableCell className="text-right font-mono">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
            {transaction.discount || transaction.fee ? (
                <>
                <TableRow>
                    <TableCell colSpan={3} className="text-right">Subtotal</TableCell>
                    <TableCell className="text-right font-mono">Rp {transaction.total.toLocaleString('id-ID')}</TableCell>
                </TableRow>
                {transaction.discount > 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="text-right">Diskon</TableCell>
                        <TableCell className="text-right font-mono text-destructive">- Rp {transaction.discount.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                )}
                 {transaction.fee > 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="text-right">Biaya Marketplace</TableCell>
                        <TableCell className="text-right font-mono text-destructive">- Rp {transaction.fee.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                )}
                 <TableRow className="font-bold text-lg">
                    <TableCell colSpan={3} className="text-right">GRAND TOTAL</TableCell>
                    <TableCell className="text-right font-mono">Rp {(transaction.netTotal ?? transaction.total).toLocaleString('id-ID')}</TableCell>
                </TableRow>
                </>
            ) : (
                 <TableRow className="font-bold text-lg">
                    <TableCell colSpan={3} className="text-right">GRAND TOTAL</TableCell>
                    <TableCell className="text-right font-mono">Rp {transaction.total.toLocaleString('id-ID')}</TableCell>
                </TableRow>
            )}
           
        </TableFooter>
      </Table>

      <footer className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>Terima kasih atas bisnis Anda!</p>
      </footer>
    </div>
  );
}
