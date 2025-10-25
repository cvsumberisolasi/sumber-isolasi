
import type { NewTax } from './types';

export const TAXES_SEED_DATA: NewTax[] = [
  {
    name: 'PPN',
    rate: 11,
    description: 'Pajak Pertambahan Nilai',
  },
  {
    name: 'PPh 23 Jasa',
    rate: 2,
    description: 'Pajak Penghasilan Pasal 23 untuk Jasa',
  },
];
