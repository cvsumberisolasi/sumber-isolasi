

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from 'next/image';
import {
  BarChart2,
  Book,
  ChevronDown,
  CircleDollarSign,
  Contact,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Landmark,
  BrainCircuit,
  PackageSearch,
  Warehouse,
  ArrowRightLeft,
  ClipboardCheck,
  Bell,
  Banknote,
  LogOut,
  RefreshCcw,
  BookUser,
  FileDigit,
  FileSpreadsheet,
  Handshake,
  FilePlus,
  PackagePlus,
  PackageCheck,
  FileKey2,
  ReceiptText,
  Factory,
  CreditCard,
  FileBox,
  FileClock,
  Printer,
  FileUp,
  Download,
  BookCopy,
  BookLock,
  Archive,
  Building,
  UserCheck,
  Percent,
  Coins,
  SlidersHorizontal,
  DatabaseZap,
  Wrench,
  Scale,
  AreaChart,
  Store,
  ArrowDownCircle,
  BookCheck,
  Palette,
  PieChart,
  Hammer,
  FileCog,
  Workflow,
  PanelLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { TokoKilatLogo } from "../icons/logo";
import type { CompanySettings } from "@/app/(app)/settings/actions";
import { Button } from "../ui/button";

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    label: "Kasir (POS)",
    icon: ShoppingCart,
    subItems: [
      { href: "/pos", label: "Transaksi Baru", icon: FilePlus },
      { href: "/pos/parked", label: "Transaksi Terparkir", icon: FileClock },
      { href: "/pos/returns", label: "Retur Kasir", icon: ArrowRightLeft },
      { href: "/pos/print", label: "Cetak Ulang Struk", icon: Printer },
    ],
  },
  {
    label: "Penjualan",
    icon: CircleDollarSign,
    subItems: [
      { href: "/transactions", label: "Riwayat Penjualan", icon: History },
      { href: "/sales/manual-input", label: "Buat Invoice", icon: FileDigit },
      { href: "/sales/receivables", label: "Piutang Usaha", icon: Handshake },
      { href: "/sales/returns", label: "Retur Penjualan", icon: ArrowRightLeft },
      { href: "/sales/import", label: "Import Marketplace", icon: Download, isDev: true },
    ],
  },
  {
    href: "/purchasing",
    label: "Pembelian",
    icon: Truck,
  },
  {
    href: "/products",
    label: "Produk & Stok",
    icon: Package,
  },
  {
    label: "Stok (Lanjutan)",
    icon: Warehouse,
    subItems: [
        { href: "/products/import", label: "Impor Produk", icon: FileUp },
        { href: "/stock/notifications", label: "Stok Menipis", icon: Bell },
        { href: "/stock-estimation", label: "Estimasi Stok (AI)", icon: BrainCircuit },
    ],
    isAdvanced: true,
  },
   {
    href: "/production",
    label: "Produksi",
    icon: Hammer,
  },
  {
    href: "/cash/out",
    label: "Pengeluaran",
    icon: ArrowDownCircle,
  },
  {
    label: "Kas & Bank",
    icon: Landmark,
    subItems: [
      { href: "/cash/in", label: "Kas Masuk", icon: Banknote },
      { href: "/cash/transfer", label: "Transfer Antar Kas", icon: ArrowRightLeft },
      { href: "/cash/reconciliation", label: "Rekonsiliasi Bank", icon: RefreshCcw, isDev: true },
    ],
  },
  {
    label: "Akuntansi",
    icon: Book,
    subItems: [
      { href: "/accounting/coa", label: "Bagan Akun (COA)", icon: FileSpreadsheet },
      { href: "/accounting/journal", label: "Jurnal Umum", icon: FileDigit },
      { href: "/accounting/ledger", label: "Buku Besar", icon: BookCopy },
      { href: "/accounting/closing", label: "Tutup Buku", icon: BookLock },
      { href: "/accounting/post-closing-trial-balance", label: "Neraca Saldo Stlh Penutupan", icon: BookCheck },
    ],
  },
  {
    href: "/reports",
    label: "Laporan",
    icon: BarChart2,
  },
    {
    label: "Master Data",
    icon: Archive,
    subItems: [
      { href: "/customers", label: "Pelanggan", icon: Users },
      { href: "/suppliers", label: "Pemasok", icon: Factory },
      { href: "/taxes", label: "Pajak", icon: Percent },
      { href: "/currencies", label: "Mata Uang", icon: Coins },
    ],
  },
  {
    label: "Pengaturan",
    icon: Settings,
    subItems: [
      { href: "/settings", label: "Profil & Tema", icon: Palette },
      { href: "/settings/accounting", label: "Akuntansi", icon: FileCog },
    ],
  },
];

function NavItem({ item, isActive, isSubActive }: { item: any, isActive: (href: string) => boolean, isSubActive: (items: any[]) => boolean }) {
  const pathname = usePathname();

  if (item.subItems) {
    return (
      <Collapsible defaultOpen={isSubActive(item.subItems)}>
        <div className="flex items-center justify-between">
          <Link href={item.subItems[0].href} className="w-full">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <item.icon className="h-5 w-5" />
              {item.label}
            </Button>
          </Link>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pl-4">
          <div className="flex flex-col gap-1 py-1 pl-4 border-l">
            {item.subItems.map((sub: any) => (
              <Button asChild key={sub.href} variant={isActive(sub.href) ? 'secondary' : 'ghost'} className="justify-start gap-2">
                <Link href={sub.href}>
                  {sub.icon && <sub.icon className="h-4 w-4" />}
                  {sub.label}
                </Link>
              </Button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant={isActive(item.href) ? 'secondary' : 'ghost'} className="justify-center sm:justify-start gap-2" aria-label={item.label}>
          <Link href={item.href}>
            <item.icon className="h-5 w-5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="sm:hidden">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

export function AppSidebar({ companySettings }: { companySettings: CompanySettings }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/products') {
        return pathname.startsWith('/products') || pathname.startsWith('/stock/warehouses') || pathname.startsWith('/stock/transfer') || pathname.startsWith('/stock/opname');
    }
    if (href === '/purchasing') {
      return pathname.startsWith('/purchasing');
    }
    if (href === '/reports') {
      return pathname.startsWith('/reports');
    }
    if (href === '/settings') {
        return pathname.startsWith('/settings');
    }
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  const isSubActive = (subItems: any[]) =>
    subItems.some((item) => item.href && isActive(item.href));
    
  const NavContent = () => (
     <nav className="grid gap-1 p-2">
        {navItems.map((item, index) => (
            <NavItem key={index} item={item} isActive={isActive} isSubActive={isSubActive}/>
        ))}
    </nav>
  )

  return (
    <>
        {/* Mobile Sidebar */}
        <Sheet>
            <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="sm:hidden fixed bottom-4 right-4 z-50">
                    <PanelLeft className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs overflow-y-auto p-0">
                <Link href="/dashboard" className="group flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    {companySettings.logoDataUrl ? (
                        <Image src={companySettings.logoDataUrl} alt="Logo" width={32} height={32} />
                    ) : (
                        <TokoKilatLogo className="h-8 w-8" />
                    )}
                    <span className="font-semibold text-lg">{companySettings.companyName || "Toko Kilat"}</span>
                </Link>
                <NavContent />
            </SheetContent>
        </Sheet>
        
        {/* Desktop Sidebar */}
        <aside className="hidden sm:flex h-screen w-14 flex-col border-r bg-background sm:fixed sm:z-50">
            <TooltipProvider>
                <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
                    <Link href="/dashboard" className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base">
                        {companySettings.logoDataUrl ? (
                            <Image src={companySettings.logoDataUrl} alt="Logo" width={24} height={24} />
                        ) : (
                            <TokoKilatLogo className="h-5 w-5 transition-all group-hover:scale-110" />
                        )}
                        <span className="sr-only">{companySettings.companyName || "Toko Kilat"}</span>
                    </Link>
                     {navItems.map((item, index) => (
                        <Tooltip key={index}>
                            <TooltipTrigger asChild>
                                <Link href={item.href || item.subItems?.[0]?.href || '#'} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8", (item.href && isActive(item.href) || (item.subItems && isSubActive(item.subItems))) && "bg-accent text-accent-foreground")}>
                                    <item.icon className="h-5 w-5" />
                                    <span className="sr-only">{item.label}</span>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                    ))}
                </nav>
                 <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
                    <ThemeToggle />
                </nav>
            </TooltipProvider>
        </aside>
    </>
  );
}
