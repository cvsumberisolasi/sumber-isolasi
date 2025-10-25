import type { NewAccount } from './types';

export const COA_SEED_DATA: NewAccount[] = [
  // 1. Aset
  // 1.1 Aset Lancar
  { code: '1-10101', name: 'Kas Kecil', type: 'Kas & Bank' },
  { code: '1-10102', name: 'Kas pada Bank ABC', type: 'Kas & Bank' },
  { code: '1-10201', name: 'Piutang Usaha', type: 'Aset Lancar' },
  { code: '1-10301', name: 'Persediaan Barang Dagang', type: 'Aset Lancar' },
  { code: '1-10302', name: 'Persediaan Bahan Baku', type: 'Aset Lancar' },
  { code: '1-10303', name: 'Persediaan Barang Dalam Proses', type: 'Aset Lancar' },
  { code: '1-10401', name: 'Sewa Dibayar di Muka', type: 'Aset Lancar' },
  // 1.2 Aset Tetap
  { code: '1-20101', name: 'Peralatan Toko', type: 'Aset Tetap' },
  { code: '1-20102', name: 'Akumulasi Penyusutan - Peralatan Toko', type: 'Akumulasi Penyusutan' },
  { code: '1-20201', name: 'Kendaraan Operasional', type: 'Aset Tetap' },
  { code: '1-20202', name: 'Akumulasi Penyusutan - Kendaraan', type: 'Akumulasi Penyusutan' },

  // 2. Kewajiban
  // 2.1 Kewajiban Jangka Pendek
  { code: '2-10101', name: 'Utang Usaha', type: 'Kewajiban Jangka Pendek' },
  { code: '2-10102', name: 'Utang Barang Diterima', type: 'Kewajiban Jangka Pendek' },
  { code: '2-10201', name: 'Utang Gaji', type: 'Kewajiban Jangka Pendek' },
  { code: '2-10301', name: 'PPN Keluaran', type: 'Kewajiban Jangka Pendek' },
  // 2.2 Kewajiban Jangka Panjang
  { code: '2-20101', name: 'Utang Bank', type: 'Kewajiban Jangka Panjang' },

  // 3. Ekuitas
  { code: '3-10101', name: 'Modal Disetor', type: 'Ekuitas' },
  { code: '3-10201', name: 'Laba Ditahan', type: 'Ekuitas' },
  { code: '3-10301', name: 'Ikhtisar Laba Rugi', type: 'Ekuitas' },

  // 4. Pendapatan
  { code: '4-10101', name: 'Pendapatan Penjualan Produk', type: 'Pendapatan' },
  { code: '4-10102', name: 'Diskon Penjualan', type: 'Pendapatan' }, // Contra-revenue
  
  // 5. Beban Pokok Penjualan (HPP/COGS)
  { code: '5-10101', name: 'Beban Pokok Penjualan', type: 'Beban Pokok Penjualan' },
  { code: '5-10102', name: 'Biaya Tenaga Kerja Langsung', type: 'Beban Pokok Penjualan' },
  { code: '5-10103', name: 'Biaya Overhead Pabrik', type: 'Beban Pokok Penjualan' },

  // 6. Beban Operasional
  { code: '6-10101', name: 'Beban Gaji & Upah', type: 'Beban Operasional' },
  { code: '6-10201', name: 'Beban Sewa Toko', type: 'Beban Operasional' },
  { code: '6-10301', name: 'Beban Listrik, Air, & Telepon', type: 'Beban Operasional' },
  { code: '6-10401', name: 'Beban Pemasaran', type: 'Beban Operasional' },
  { code: '6-10501', name: 'Beban Penyusutan Peralatan', type: 'Beban Operasional' },
  { code: '6-10601', name: 'Beban Marketplace', type: 'Beban Operasional' },
  { code: '6-10999', name: 'Beban Operasional Lainnya', type: 'Beban Operasional' },

  // 8. Pendapatan & Beban Lainnya
  { code: '8-10101', name: 'Pendapatan Bunga Bank', type: 'Pendapatan Lainnya' },
  { code: '9-10101', name: 'Beban Administrasi Bank', type: 'Beban Lainnya' },
];
