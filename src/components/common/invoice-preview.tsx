

'use client';

import type { CompanySettings } from '@/app/(app)/settings/actions';
import type { Customer, Transaction } from '@/lib/types';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface InvoicePreviewProps {
  transaction: Transaction;
  companySettings: CompanySettings;
  customer: Customer | null;
}

export function InvoicePreview({ transaction, companySettings, customer }: InvoicePreviewProps) {
  if (!transaction) return null;

  const terbilang = (angka: number) => {
    // Logic to convert number to words - simple version
    const bilangan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    
    if (angka < 12) {
      return bilangan[angka];
    } else if (angka < 20) {
      return terbilang(angka - 10) + " Belas";
    } else if (angka < 100) {
      return terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
    } else if (angka < 200) {
      return "Seratus " + terbilang(angka - 100);
    } else if (angka < 1000) {
      return terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
    } else if (angka < 2000) {
      return "Seribu " + terbilang(angka - 1000);
    } else if (angka < 1000000) {
      return terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
    } else if (angka < 1000000000) {
      return terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
    }
    return "";
  };
  
  const totalAmount = transaction.netTotal ?? transaction.total;
  const amountInWords = terbilang(totalAmount) + " Rupiah";


  return (
    <div className="p-4 bg-background font-sans text-xs">
      {/* Each div here is roughly one third of an A4 page */}
      <div className="h-[9.9cm] w-[21cm] p-2 flex flex-col">
        <header className="flex justify-between items-start pb-2 border-b">
          <div className="flex-1 space-y-px">
            <h1 className="text-base font-bold">{companySettings.companyName}</h1>
            <p className="text-xs">{companySettings.address}</p>
            <p className="text-xs">{companySettings.phone} | {companySettings.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold">INVOICE</h2>
            <p className="font-mono text-xs">#{transaction.id}</p>
          </div>
        </header>

        <section className="flex justify-between my-2">
            <div className="w-1/2">
                <p className="font-semibold">Kepada Yth:</p>
                <p className="font-bold">{customer?.name || transaction.customerName}</p>
                <p>{customer?.address}</p>
            </div>
             <div className="text-right">
                <p>Tanggal: {format(transaction.date, 'dd MMMM yyyy', { locale: id })}</p>
                <p>Jatuh Tempo: {format(new Date(new Date(transaction.date).setDate(transaction.date.getDate() + 14)), 'dd MMMM yyyy', { locale: id })}</p>
            </div>
        </section>

        <div className="flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-6 px-2 py-1">No.</TableHead>
                <TableHead className="h-6 px-2 py-1">Deskripsi</TableHead>
                <TableHead className="h-6 px-2 py-1 text-center">Qty</TableHead>
                <TableHead className="h-6 px-2 py-1 text-right">Harga Satuan</TableHead>
                <TableHead className="h-6 px-2 py-1 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaction.items.map((item, index) => (
                <TableRow key={item.productId}>
                  <TableCell className="px-2 py-1">{index + 1}</TableCell>
                  <TableCell className="px-2 py-1">{item.productName}</TableCell>
                  <TableCell className="px-2 py-1 text-center">{item.quantity} {item.unit}</TableCell>
                  <TableCell className="px-2 py-1 text-right font-mono">{item.price.toLocaleString('id-ID')}</TableCell>
                  <TableCell className="px-2 py-1 text-right font-mono">{(item.price * item.quantity).toLocaleString('id-ID')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <footer className="mt-2 pt-2 border-t flex justify-between items-end">
          <div className="w-2/3">
             <p className="font-semibold">Terbilang:</p>
             <p className="italic bg-muted p-1 rounded-sm text-xs">{amountInWords}</p>
             <p className="mt-4">Diterima oleh,</p>
             <div className="mt-12">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          </div>
          <div className="w-1/3 text-right">
             <Table>
                <TableBody>
                  {transaction.discount || transaction.fee ? (
                  <>
                  <TableRow className="border-none"><TableCell className="p-1 text-right">Subtotal</TableCell><TableCell className="p-1 text-right font-mono">{transaction.total.toLocaleString('id-ID')}</TableCell></TableRow>
                  {transaction.discount > 0 && (<TableRow className="border-none"><TableCell className="p-1 text-right">Diskon</TableCell><TableCell className="p-1 text-right font-mono text-destructive">- {transaction.discount.toLocaleString('id-ID')}</TableCell></TableRow>)}
                  {transaction.fee > 0 && (<TableRow className="border-none"><TableCell className="p-1 text-right">Biaya</TableCell><TableCell className="p-1 text-right font-mono text-destructive">- {transaction.fee.toLocaleString('id-ID')}</TableCell></TableRow>)}
                  <TableRow className="border-t font-bold"><TableCell className="p-1 text-right">GRAND TOTAL</TableCell><TableCell className="p-1 text-right font-mono">Rp {(transaction.netTotal ?? transaction.total).toLocaleString('id-ID')}</TableCell></TableRow>
                  </>
                  ) : (
                  <TableRow className="border-t font-bold"><TableCell className="p-1 text-right">GRAND TOTAL</TableCell><TableCell className="p-1 text-right font-mono">Rp {transaction.total.toLocaleString('id-ID')}</TableCell></TableRow>
                  )}
                </TableBody>
             </Table>
              <div className="mt-4 text-center">
                <p>Hormat kami,</p>
                <div className="mt-12">({companySettings.companyName})</div>
              </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
