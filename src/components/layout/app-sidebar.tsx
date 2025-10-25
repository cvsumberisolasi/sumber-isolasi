

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar,
  SidebarFooter,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { TokoKilatLogo } from "../icons/logo";

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
    href: "/settings",
    label: "Pengaturan",
    icon: Settings,
  },
];

export function AppSidebar({ companyName }: { companyName: string }) {
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

  return (
    <Sidebar
      className="border-r"
    >
       <SidebarHeader className="flex items-center gap-2">
        <TokoKilatLogo />
        <span className="text-lg font-headline font-semibold text-primary">
          {companyName}
        </span>
      </SidebarHeader>
        <SidebarContent>
        <SidebarMenu>
          {navItems.map((item, index) =>
            item.subItems ? (
              <SidebarMenuItem key={`${item.label}-${index}`}>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="w-full justify-between font-headline"
                      isActive={isSubActive(item.subItems)}
                       tooltip={{
                        children: item.label,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.subItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.href}>
                           <SidebarMenuSubButton
                              href={subItem.href || "#"}
                              isActive={isActive(subItem.href || "#")}
                            >
                              {subItem.icon && <subItem.icon />}
                              <span>{subItem.label}</span>
                              {subItem.isDev && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Wrench className="ml-auto h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" align="center">
                                    <p>Dalam Pengembangan</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href || "#"}>
                  <SidebarMenuButton
                    isActive={isActive(item.href || "#")}
                    tooltip={{
                      children: item.label,
                    }}
                    className="font-headline"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
       <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
