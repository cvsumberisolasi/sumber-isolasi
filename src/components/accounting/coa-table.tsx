
'use client';

import type { Account } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CoaRowActions } from './coa-actions';
import Link from 'next/link';
import { Button } from '../ui/button';

type AccountWithBalance = Account & { balance: number };

interface CoaTableProps {
  data: AccountWithBalance[];
}

export function CoaTable({ data }: CoaTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode Akun</TableHead>
            <TableHead>Nama Akun</TableHead>
            <TableHead>Tipe Akun</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono">{account.code}</TableCell>
              <TableCell className="font-medium">
                <Button variant="link" asChild className="p-0 h-auto font-medium text-left">
                  <Link href={`/accounting/ledger?accountId=${account.id}`}>{account.name}</Link>
                </Button>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{account.type}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                Rp {account.balance.toLocaleString('id-ID')}
              </TableCell>
               <TableCell className="text-right">
                <CoaRowActions account={account} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
