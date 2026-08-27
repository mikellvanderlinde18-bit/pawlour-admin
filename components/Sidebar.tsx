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
  CreditCardIcon,
  GearIcon,
  ChevronDownIcon,
  LogOutIcon,
} from "./icons";

// Always visible — the stuff you reach for constantly, especially on a
// chaotic day. Nothing here is a "set it once and forget it" screen.
const DAILY_ITEMS = [
  { href: "/dashboard", label: "Overview", Icon: HomeIcon },
  { href: "/dashboard/bookings", label: "All bookings", Icon: CalendarIcon },
  { href: "/dashboard/bookings/new", label: "New booking", Icon: PlusCircleIcon },
  { href: "/dashboard/clients", label: "Clients", Icon: UsersIcon },
  { href: "/dashboard/reports", label: "Reports", Icon: ChartIcon },
];

// Collapsed by default — configured once, then rarely touched again.
const SETTINGS_ITEMS = [
  { href: "/dashboard/services", label: "Services & pricing", Icon: ScissorsIcon },
  { href: "/dashboard/groomers", label: "Groomers", Icon: UsersIcon },
  { href: "/dashboard/hours", label: "Opening hours", Icon: ClockIcon },
  { href: "/dashboard/rewards", label: "Rewards", Icon: GiftIcon },
  { href: "/dashboard/offers", label: "Offers", Icon: TagIcon },
  { href: "/dashboard/branding", label: "Branding", Icon: PaletteIcon },
  { href: "/dashboard/payment-setup", label: "Payment setup", Icon: CreditCardIcon },
  { href: "/dashboard/billing", label: "Billing", Icon: CreditCardIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [parlourName, setParlourName] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);

  const isOnSettingsPage = SETTINGS_ITEMS.some((item) => pathname === item.href);
  const [settingsOpen, setSettingsOpen] = useState(isOnSettingsPage);

  // If the user navigates directly to a settings page (e.g. a bookmark or
  // link), make sure the group is visibly expanded rather than hiding the
  // active item inside a collapsed section.
  useEffect(() => {
    if (isOnSettingsPage) setSettingsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  function renderItem(item: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }) {
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

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {DAILY_ITEMS.map(renderItem)}

        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 mt-4 rounded-lg text-sm text-[#14261F]/60 hover:bg-black/[0.04] hover:text-[#14261F] transition-colors"
        >
          <GearIcon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDownIcon
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {settingsOpen && (
          <div className="space-y-0.5 pl-1 border-l border-black/[0.06] ml-4 mt-1">
            {SETTINGS_ITEMS.map(renderItem)}
          </div>
        )}
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
