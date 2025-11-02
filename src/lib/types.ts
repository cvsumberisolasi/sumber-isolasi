

import { Timestamp } from 'firebase/firestore';

export type ProductType = 'Barang Jadi' | 'Bahan Baku' | 'Barang Dagang';

export type ProductUnit = {
  name: string; // e.g., 'Pcs', 'Box', 'Lusin'
  price: number;
  cost: number;
  conversionRate: number; // How many base units are in this unit. Base unit has 1.
};

export type Product = {
  id: string;
  sku?: string; // Stock Keeping Unit
  name: string;
  category: string;
  productType: string[];
  stock: number; // Total stock in base unit
  cost?: number; // Base cost of the product
  units: ProductUnit[];
  baseUnit: string; // Name of the base unit, e.g., 'Pcs'
  minStockThreshold?: number;
};

export type NewProduct = Omit<Product, 'id'>;


export type ProductCategory = {
  id: string;
  name: string;
  description: string;
};

export type NewProductCategory = Omit<ProductCategory, 'id'>;


export type TransactionItem = {
  productId: string;
  productName: string; // denormalized for easier display
  quantity: number;
  price: number;
  cost: number; // denormalized for COGS calculation
  unit: string; // The unit of sale, e.g., 'Pcs' or 'Box'
};

export type Transaction = {
  id: string;
  date: Date;
  items: TransactionItem[];
  subtotal: number;
  taxId?: string;
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
  grandTotal: number;
  discount?: number;
  fee?: number;
  netTotal?: number;
  paymentMethod: 'Tunai' | 'Transfer' | 'Kredit';
  status: 'Lunas' | 'Belum Lunas';
  customerId?: string;
  customerName?: string;
  channel?: string;
  total: number;
};

export type NewTransaction = Omit<Transaction, 'id' | 'date' | 'total'> & {
  date: Date; 
};

export type CartItem = {
  product: Product;
  quantity: number;
  unit: ProductUnit; // The selected unit for this cart item
};

export type ParkedTransaction = {
    id: string;
    name: string;
    cart: CartItem[];
    createdAt: Timestamp; // Firestore timestamp
}

export type NewParkedTransaction = Omit<ParkedTransaction, 'id'>;


export type SalesReturnItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
  unit: string;
}

export type SalesReturn = {
  id: string;
  date: Date;
  originalTransactionId: string;
  items: SalesReturnItem[];
  total: number; // This is the total value of returned goods, equivalent to subtotal
  originalPaymentMethod: 'Tunai' | 'Transfer' | 'Kredit';
}

export type NewSalesReturn = Omit<SalesReturn, 'id'>;


export type SalesData = {
  day: string;
  total: number;
};

export type TopProductData = {
  name: string;
  sold: number;
};

export type MonthlyRevenue = {
  month: string;
  revenue: number;
};

export type SalesMetric = {
  grossSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  productsSold: number;
};

export type ProductSalesSummary = {
  productId: string;
  productName: string;
  quantitySold: number;
  grossRevenue: number;
  grossProfit: number;
};

export type SalesTrendData = {
  date: string;
  total: number;
};


export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type NewCustomer = Omit<Customer, 'id'>;

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type NewSupplier = Omit<Supplier, 'id'>;


export type PurchaseRequestItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
};

export type PurchaseRequest = {
  id: string;
  date: Date;
  requestedBy: string;
  items: PurchaseRequestItem[];
  notes?: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected' | 'Processed';
};

export type NewPurchaseRequest = Omit<PurchaseRequest, 'id' | 'date'> & {
    date: Date;
};


export type PurchaseOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
  unit: string;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  date: Date;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxId?: string;
  taxName?: string;
  taxRate?: number;
  taxAmount?: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Completed' | 'Cancelled';
  purchaseRequestId?: string;
  total: number; // legacy, replaced by grandTotal
};

export type NewPurchaseOrder = Omit<PurchaseOrder, 'id' | 'date' | 'total'> & {
    date: Date;
};

export type GoodsReceiptItem = {
    productId: string;
    productName: string;
    quantity: number; // Jumlah yang dipesan
    receivedQuantity: number;
    cost: number;
    unit: string;
};

export type GoodsReceipt = {
    id: string;
    date: Date;
    purchaseOrderId: string;
    supplierId: string;
    supplierName: string;
    items: GoodsReceiptItem[];
    status: 'Pending Invoice' | 'Invoiced';
};

export type NewGoodsReceipt = Omit<GoodsReceipt, 'id' | 'date' | 'status'> & {
    date: Date;
};

export type SupplierInvoice = {
    id: string;
    date: Date;
    invoiceNumber: string;
    goodsReceiptId: string;
    purchaseOrderId: string;
    supplierId: string;
    supplierName: string;
    subtotal: number;
    taxId?: string;
    taxName?: string;
    taxRate?: number;
    taxAmount?: number;
    grandTotal: number;
    status: 'Unpaid' | 'Paid';
    total: number; // legacy, replaced by grandTotal
}

export type NewSupplierInvoice = Omit<SupplierInvoice, 'id' | 'status' | 'total'> & {
  date: Date;
};

export type PurchasePayment = {
    id: string;
    date: Date;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paymentAccountId: string; // ID of the cash/bank account
}

export type NewPurchasePayment = Omit<PurchasePayment, 'id' | 'date'> & {
    date: Date;
};


export type PurchaseReturnItem = {
  productId: string;
  productName: string;
  returnQuantity: number;
  cost: number;
  unit: string;
};

export type PurchaseReturn = {
  id: string;
  date: Date;
  goodsReceiptId: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseReturnItem[];
  total: number;
  reason: string;
};

export type NewPurchaseReturn = Omit<PurchaseReturn, 'id' | 'date'> & {
    date: Date;
};


export type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type NewAccount = Omit<Account, 'id'>;

export type JournalEntry = {
  accountId: string;
  accountName: string; // Denormalized for display
  debit: number;
  credit: number;
};

export type Journal = {
  id: string;
  date: Date;
  refNumber: string;
  description: string;
  entries: JournalEntry[];
  total: number;
};

export type NewJournal = Omit<Journal, 'id' | 'date'> & {
  date: Date; 
};

export type Warehouse = {
    id: string;
    name: string;
    address: string;
    isDefault: boolean;
};
export type NewWarehouse = Omit<Warehouse, 'id'>;


export type StockTransferItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}
export type StockTransfer = {
    id: string;
    date: Date;
    fromWarehouseId: string;
    fromWarehouseName: string;
    toWarehouseId: string;
    toWarehouseName: string;
    items: StockTransferItem[];
    notes?: string;
}
export type NewStockTransfer = Omit<StockTransfer, 'id' | 'date'> & {
    date: Date;
};

export type StockOpnameItem = {
  productId: string;
  productName: string;
  systemStock: number;
  physicalCount: number;
  difference: number;
  differenceValue: number;
};

export type StockOpname = {
  id: string;
  date: Timestamp;
  warehouseId: string;
  warehouseName: string;
  notes?: string;
  items: StockOpnameItem[];
  totalAdjustmentValue: number;
};

export type NewStockOpname = Omit<StockOpname, 'id'>;


export type Tax = {
    id: string;
    name: string;
    rate: number; // in percent, e.g., 11 for 11%
    description: string;
};
export type NewTax = Omit<Tax, 'id'>;

export type Currency = {
    id: string;
    name: string;
    code: string; // e.g., USD, IDR
    symbol: string; // e.g., $, Rp
    exchangeRate: number; // relative to base currency
};
export type NewCurrency = Omit<Currency, 'id'>;

export type MarketplaceStore = {
  id: string;
  marketplace: 'Tokopedia' | 'Shopee' | 'TikTok' | 'Lazada' | 'BigSeller' | 'Lainnya';
  storeName: string;
  nickname: string;
};
export type NewMarketplaceStore = Omit<MarketplaceStore, 'id'>;

export type ParsedRow = {
  id: string;
  tanggal_order: string;
  nomor_order: string;
  channel: string;
  nama_pembeli: string;
  alamat_lengkap: string;
  sku: string;
  nama_produk: string;
  qty: number;
  unit_price: number;
  cost: number;
  subtotal: number;
  shipping: number;
  fee: number;
  discount: number;
  net_total: number;
};

export type MappedRow = Omit<ParsedRow, 'id'> & { id: string };

export type ImportRow = MappedRow & {
    mappedProduct: Product | null;
};

export type SkuMapping = {
    id: string;
    marketplaceSku: string;
    channel: string;
    productId: string;
    productName: string;
};
export type NewSkuMapping = Omit<SkuMapping, 'id'>;


// Production Module Types
export type BillOfMaterialItem = {
  productId: string; // Raw material product ID
  productName: string;
  quantity: number;
  unit: string;
};

export type AdditionalCostItem = {
    accountId: string;
    accountName: string;
    amount: number;
};

export type BillOfMaterial = {
  id: string;
  productId: string; // Finished good product ID
  productName: string;
  quantityProduced: number; // Quantity of finished good produced from this BOM
  items: BillOfMaterialItem[];
  additionalCosts?: AdditionalCostItem[];
};

export type NewBillOfMaterial = Omit<BillOfMaterial, 'id'>;

export type WorkOrder = {
  id: string;
  date: Date;
  finishedGoodId: string;
  finishedGoodName: string;
  quantityToProduce: number;
  bomId: string;
  status: 'Belum Diproses' | 'Dalam Pengerjaan' | 'Selesai' | 'Dibatalkan';
  notes?: string;
  startDate: Date;
  endDate: Date;
};

export type NewWorkOrder = Omit<WorkOrder, 'id' | 'date' | 'startDate' | 'endDate'> & {
    date: Date;
    startDate: Date;
    endDate: Date;
};

export type ProductionCompletionItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type ProductionCompletion = {
  id: string;
  date: Date;
  workOrderId: string;
  finishedGoodId: string;
  finishedGoodName: string;
  quantityProduced: number;
  consumedItems: ProductionCompletionItem[];
  additionalCosts: AdditionalCostItem[];
  totalCost: number;
};

export type NewProductionCompletion = Omit<ProductionCompletion, 'id' | 'date'> & { date: Date };


// Fixed Assets Module Types
export type FixedAsset = {
  id: string;
  assetCode: string;
  name: string;
  description: string;
  acquisitionDate: Timestamp;
  acquisitionCost: number;
  usefulLife: number; // in years
  depreciationMethod: 'Garis Lurus';
  assetAccountId: string;
  assetAccountName: string;
  accumulatedDepreciationAccountId: string;
  accumulatedDepreciationAccountName: string;
  depreciationExpenseAccountId: string;
  depreciationExpenseAccountName: string;
};

export type NewFixedAsset = Omit<FixedAsset, 'id'>;

export type DepreciationRun = {
  id: string;
  date: Timestamp;
  month: number;
  year: number;
  journalId: string;
  totalDepreciation: number;
  assetsDepreciated: number;
};
