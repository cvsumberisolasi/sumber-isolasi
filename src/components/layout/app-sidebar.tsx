

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
import { Button } from "../ui/button";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { TokoKilatLogo } from "../icons/logo";
import type { CompanySettings } from "@/app/(app)/settings/actions";

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    href: "/pos",
    icon: ShoppingCart,
    label: "Kasir (POS)",
  },
  {
    href: "/sales",
    icon: CircleDollarSign,
    label: "Penjualan",
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
    href: "/production",
    label: "Produksi",
    icon: Hammer,
  },
  {
    href: "/fixed-assets",
    label: "Aset Tetap",
    icon: Building,
  },
  {
    href: "/cash",
    label: "Kas & Bank",
    icon: Landmark,
  },
  {
    href: "/accounting",
    label: "Akuntansi",
    icon: Book,
  },
  {
    href: "/reports",
    label: "Laporan",
    icon: BarChart2,
  },
  {
    href: "/customers",
    label: "Pelanggan",
    icon: Users,
  },
  {
    href: "/suppliers",
    label: "Pemasok",
    icon: Factory,
  },
  {
    href: "/settings",
    label: "Pengaturan",
    icon: Settings,
  },
];

function NavItem({ item, isActive }: { item: any, isActive: (href: string) => boolean }) {
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant={isActive(item.href) ? 'secondary' : 'ghost'} className="justify-center sm:justify-start gap-2" aria-label={item.label}>
          <Link href={item.href}>
            <item.icon className="h-5 w-5" />
            <span className="sm:inline">{item.label}</span>
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
    if (href === '/products') return pathname.startsWith('/products') || pathname.startsWith('/stock');
    if (href === '/sales') return pathname.startsWith('/sales') || pathname.startsWith('/transactions');
    if (href === '/purchasing') return pathname.startsWith('/purchasing');
    if (href === '/reports') return pathname.startsWith('/reports');
    if (href === '/settings') return pathname.startsWith('/settings');
    if (href === '/accounting') return pathname.startsWith('/accounting');
    if (href === '/cash') return pathname.startsWith('/cash');
    if (href === '/pos') return pathname.startsWith('/pos');
    if (href === '/fixed-assets') return pathname.startsWith('/fixed-assets');
    
    return pathname === href;
  };

  const NavContent = () => (
     <nav className="grid gap-1 p-2">
        {navItems.map((item, index) => (
            <NavItem key={index} item={item} isActive={isActive}/>
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
                    <span className="sr-only">Buka Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs overflow-y-auto p-0">
                <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
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
                                <Link href={item.href || '#'} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8", isActive(item.href || '') && "bg-accent text-accent-foreground")}>
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
