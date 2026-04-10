import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Coffee,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  QrCode,
  Shield,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type DashboardLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  adminOnly?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/dashboard" },
  { icon: CreditCard, label: "購入申請", path: "/purchase" },
  { icon: QrCode, label: "利用ページ", path: "/use" },
  { icon: Shield, label: "管理画面", path: "/admin", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "coffee-ticket-sidebar-width";
const DEFAULT_WIDTH = 296;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(106,72,42,0.18),_transparent_35%),linear-gradient(180deg,_#f7f1ea_0%,_#f2ebe3_45%,_#eee5da_100%)] text-foreground">
        <div className="container flex min-h-screen items-center justify-center py-12">
          <div className="w-full max-w-xl rounded-[32px] border border-white/50 bg-white/75 p-10 shadow-[0_24px_80px_rgba(74,44,18,0.12)] backdrop-blur-xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-900/10 bg-amber-50/70 px-4 py-2 text-sm text-amber-950/75">
              <Coffee className="h-4 w-4" />
              研究室用コーヒーチケット管理サービス
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
              洗練された運用を支える、
              <span className="block text-stone-700">研究室専用のコーヒーワークフロー。</span>
            </h1>
            <p className="mt-5 text-base leading-7 text-stone-600">
              残チケット確認、購入申請、QR経由の利用、管理者承認までを一貫して扱える内部向けアプリです。
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 rounded-full bg-stone-900 px-8 text-sm font-medium text-stone-50 shadow-[0_16px_30px_rgba(41,28,18,0.18)] hover:bg-stone-800"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              Manus OAuthでサインイン
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent title={title} subtitle={subtitle} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, title, subtitle, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter(item => !item.adminOnly || user?.role === "admin");
  }, [user?.role]);

  const activeMenuItem = visibleMenuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(111,78,55,0.12),_transparent_30%),linear-gradient(180deg,_#f7f2eb_0%,_#f3ece4_48%,_#efe6da_100%)] text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.12),transparent_28%,transparent_72%,rgba(255,255,255,0.08))]" />
      <div className="relative flex min-h-screen">
        <div className="relative" ref={sidebarRef}>
          <Sidebar collapsible="icon" className="border-r-0 bg-transparent" disableTransition={isResizing}>
            <SidebarHeader className="px-4 pb-4 pt-5">
              <div className="rounded-[26px] border border-white/50 bg-white/78 p-4 shadow-[0_20px_50px_rgba(66,43,24,0.08)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSidebar}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-stone-50 transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="ナビゲーション切替"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                  {!isCollapsed ? (
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Lab Brew</p>
                      <p className="truncate text-lg font-semibold tracking-tight text-stone-900">
                        Coffee Ticket
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-4 pb-4">
              <div className="rounded-[28px] border border-white/50 bg-white/72 p-3 shadow-[0_18px_48px_rgba(66,43,24,0.08)] backdrop-blur-xl">
                <SidebarMenu className="gap-2">
                  {visibleMenuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-12 rounded-2xl px-3 text-sm font-medium transition"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-stone-500"}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            </SidebarContent>

            <SidebarFooter className="px-4 pb-5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full rounded-[24px] border border-white/50 bg-white/78 p-3 text-left shadow-[0_18px_48px_rgba(66,43,24,0.08)] transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 border border-stone-200/80 bg-stone-100">
                        <AvatarFallback className="bg-stone-200 text-sm font-semibold text-stone-700">
                          {(user?.displayName || user?.name)?.charAt(0)?.toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      {!isCollapsed ? (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900">{user?.displayName || user?.name || "研究室メンバー"}</p>
                          <p className="mt-1 truncate text-xs text-stone-500">{user?.email || "メール未設定"}</p>
                          <Badge className="mt-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100">
                            {user?.role === "admin" ? "管理者" : "一般ユーザー"}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border-stone-200/70 bg-white/95 backdrop-blur">
                  <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-xl text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>サインアウト</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>

          <div
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
            onMouseDown={() => {
              if (isCollapsed) return;
              setIsResizing(true);
            }}
            style={{ zIndex: 50 }}
          />
        </div>

        <SidebarInset className="bg-transparent">
          {isMobile ? (
            <div className="sticky top-0 z-40 border-b border-white/40 bg-white/75 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="h-10 w-10 rounded-2xl bg-white/90 shadow-sm" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Navigation</p>
                    <p className="text-sm font-semibold text-stone-900">{activeMenuItem?.label ?? title ?? "Coffee Ticket"}</p>
                  </div>
                </div>
                <Badge className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-900">
                  {user?.role === "admin" ? "管理者" : "利用者"}
                </Badge>
              </div>
            </div>
          ) : null}

          <main className="relative flex-1 p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              <header className="rounded-[30px] border border-white/50 bg-white/72 px-6 py-6 shadow-[0_20px_60px_rgba(66,43,24,0.08)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Coffee Ticket Service</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
                      {title ?? activeMenuItem?.label ?? "ダッシュボード"}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
                      {subtitle ?? "研究室内のコーヒー豆チケット運用を、上品で見通しのよいUIで一元管理できます。"}
                    </p>
                  </div>
                  <div className="hidden items-center gap-3 md:flex">
                    <Badge className="rounded-full border border-stone-300/70 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white/80">
                      現在のロール: {user?.role === "admin" ? "管理者" : "一般ユーザー"}
                    </Badge>
                  </div>
                </div>
              </header>
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </div>
  );
}
