"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { BrandMark, Sidebar, SidebarNav } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const COLLAPSE_KEY = "profittrack:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    setCollapsed(stored === "1");
  }, []);

  const toggle = () => {
    setCollapsed((current) => {
      window.localStorage.setItem(COLLAPSE_KEY, current ? "0" : "1");
      return !current;
    });
  };

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-border bg-card/40 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          ProfitTrack · Your data is synced securely to your account
        </footer>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                ProfitTrack
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Reseller profit book
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 py-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
