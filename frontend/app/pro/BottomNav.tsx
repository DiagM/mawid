"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, LogoutIcon, StoreIcon } from "@/components/icons";

const TABS = [
  { href: "/pro/agenda", label: "Agenda", icon: CalendarIcon },
  { href: "/pro/salon", label: "Salon", icon: StoreIcon },
] as const;

export function BottomNav({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-navy/10 bg-white/95 backdrop-blur"
      aria-label="Navigation principale"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-navy" : "text-navy/40"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-sand" : ""}`} />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onLogout}
        className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-navy/40 hover:text-danger"
      >
        <LogoutIcon className="h-5 w-5" />
        Quitter
      </button>
    </nav>
  );
}
