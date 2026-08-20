"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  HomeIcon,
  CalendarIcon,
  PlusCircleIcon,
  ScissorsIcon,
  UsersIcon,
  ClockIcon,
  GiftIcon,
  TagIcon,
  ChartIcon,
  PaletteIcon,
  LogOutIcon,
} from "./icons";

const NAV_SECTIONS = [
  {
    items: [{ href: "/dashboard", label: "Overview", Icon: HomeIcon }],
  },
  {
    label: "Bookings",
    items: [
      { href: "/dashboard/bookings", label: "All bookings", Icon: CalendarIcon },
      { href: "/dashboard/bookings/new", label: "New booking", Icon: PlusCircleIcon },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/dashboard/services", label: "Services & pricing", Icon: ScissorsIcon },
      { href: "/dashboard/groomers", label: "Groomers", Icon: UsersIcon },
      { href: "/dashboard/clients", label: "Clients", Icon: UsersIcon },
      { href: "/dashboard/hours", label: "Opening hours", Icon: ClockIcon },
      { href: "/dashboard/branding", label: "Branding", Icon: PaletteIcon },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/dashboard/rewards", label: "Rewards", Icon: GiftIcon },
      { href: "/dashboard/offers", label: "Offers", Icon: TagIcon },
      { href: "/dashboard/reports", label: "Reports", Icon: ChartIcon },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [parlourName, setParlourName] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("parlour_staff")
        .select("parlour:parlour_id(name, tier)")
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle();
      const p = data?.parlour as unknown as { name: string; tier: string } | null;
      if (p) {
        setParlourName(p.name);
        setTier(p.tier);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 bg-white border-r border-black/[0.06] flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#14261F] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-[#E8A87C]">🐾</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#14261F] truncate">{parlourName ?? "Loading…"}</p>
            {tier && (
              <p className="text-[11px] text-[#14261F]/40 capitalize">{tier} plan</p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#14261F]/35">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.Icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-[#14261F] text-white font-medium"
                        : "text-[#14261F]/70 hover:bg-black/[0.04] hover:text-[#14261F]"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-black/[0.06]">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#14261F]/60 hover:bg-black/[0.04] hover:text-[#14261F] transition-colors"
        >
          <LogOutIcon className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
