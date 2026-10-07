"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, Plus, Search, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductDialog } from "@/components/providers/app-providers";
import { BrandMark } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { openDialog } = useProductDialog();
  const [query, setQuery] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 lg:hidden">
        <BrandMark className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">ProfitTrack</span>
      </div>

      <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-md flex-1 md:block lg:ml-0 lg:max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products, details or suppliers…"
          aria-label="Global search"
          className="bg-muted/50 pl-9 shadow-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        {offline ? (
          <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 sm:inline-flex">
            <WifiOff className="h-3 w-3" />
            Offline — sync paused
          </span>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search products"
          onClick={() => router.push("/products")}
        >
          <Search className="h-[18px] w-[18px]" />
        </Button>

        <ThemeToggle />

        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: "h-9! w-9!",
              userButtonBox: "h-9! w-9!",
              avatarBox: "h-9! w-9!",
            },
          }}
          aria-label="Account"
        />

        <Button
          onClick={() => openDialog()}
          className="gap-1.5 shadow-sm max-sm:px-3"
          aria-label="Add product"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Product</span>
        </Button>
      </div>
    </header>
  );
}
