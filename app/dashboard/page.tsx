import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: staffRows } = await supabase
    .from("parlour_staff")
    .select("role, parlour:parlour_id(id, name, subdomain, tier, status, trial_ends_at)")
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: true });

  type ParlourInfo = {
    id: string;
    name: string;
    subdomain: string;
    tier: string;
    status: string;
    trial_ends_at: string;
  };

  const parlours = (staffRows ?? []) as unknown as { role: string; parlour: ParlourInfo }[];
  const staffRow = parlours[0];
  const parlour = staffRow?.parlour;

  let todayCount = 0;
  let weekCount = 0;
  let nextBooking: { starts_at: string; service_name: string | null; client_name: string | null } | null = null;

  if (parlour) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: today }, { count: week }, { data: nextRows }] = await Promise.all([
      supabase
        .from("booking")
        .select("id", { count: "exact", head: true })
        .eq("parlour_id", parlour.id)
        .eq("status", "confirmed")
        .gte("starts_at", todayStart)
        .lt("starts_at", todayEnd),
      supabase
        .from("booking")
        .select("id", { count: "exact", head: true })
        .eq("parlour_id", parlour.id)
        .eq("status", "confirmed")
        .gte("starts_at", now.toISOString())
        .lt("starts_at", weekEnd),
      supabase
        .from("booking")
        .select("starts_at, service:service_id(name), client:client_id(name)")
        .eq("parlour_id", parlour.id)
        .eq("status", "confirmed")
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1),
    ]);

    todayCount = today ?? 0;
    weekCount = week ?? 0;

    const row = nextRows?.[0] as unknown as
      | { starts_at: string; service: { name: string } | null; client: { name: string } | null }
      | undefined;
    if (row) {
      nextBooking = {
        starts_at: row.starts_at,
        service_name: row.service?.name ?? null,
        client_name: row.client?.name ?? null,
      };
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="max-w-4xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#14261F] mb-1">
              {parlour ? `Welcome back` : "Dashboard"}
            </h1>
            <p className="text-sm text-[#14261F]/50">{user.email}</p>
          </div>
          {parlour && (
            <a
              href="/dashboard/bookings/new"
              className="bg-[#14261F] text-[#FAF6EF] rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + New booking
            </a>
          )}
        </div>

        {parlour ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-black/10 rounded-2xl p-5">
                <p className="text-xs text-[#14261F]/50 mb-1">Today</p>
                <p className="text-2xl font-semibold text-[#14261F]">{todayCount}</p>
                <p className="text-xs text-[#14261F]/40 mt-0.5">bookings</p>
              </div>
              <div className="bg-white border border-black/10 rounded-2xl p-5">
                <p className="text-xs text-[#14261F]/50 mb-1">Next 7 days</p>
                <p className="text-2xl font-semibold text-[#14261F]">{weekCount}</p>
                <p className="text-xs text-[#14261F]/40 mt-0.5">bookings</p>
              </div>
              <div className="bg-white border border-black/10 rounded-2xl p-5">
                <p className="text-xs text-[#14261F]/50 mb-1">Plan</p>
                <p className="text-2xl font-semibold text-[#14261F] capitalize">{parlour.tier}</p>
                <p className="text-xs text-[#14261F]/40 mt-0.5 capitalize">{parlour.status}</p>
              </div>
            </div>

            {nextBooking && (
              <a
                href="/dashboard/bookings"
                className="block bg-white border border-black/10 rounded-2xl p-5 mb-6 hover:border-black/20 transition-colors"
              >
                <p className="text-xs text-[#14261F]/50 mb-1">Next up</p>
                <p className="text-sm font-medium text-[#14261F]">
                  {nextBooking.service_name ?? "Booking"} with {nextBooking.client_name ?? "a client"}
                </p>
                <p className="text-xs text-[#14261F]/50 mt-0.5">
                  {new Date(nextBooking.starts_at).toLocaleString("en-ZA", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
              </a>
            )}

            <div className="bg-white border border-black/10 rounded-2xl p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[#14261F]/50">Booking link</div>
                <div className="font-medium text-[#14261F]">{parlour.subdomain}.pawlour.app</div>
              </div>
              <div>
                <div className="text-[#14261F]/50">Trial ends</div>
                <div className="font-medium text-[#14261F]">
                  {new Date(parlour.trial_ends_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white border border-black/10 rounded-2xl p-6 text-sm text-[#14261F]/60">
            No parlour linked to this account yet.
          </div>
        )}

        {parlours.length > 1 && (
          <p className="text-xs text-[#D98F5F] mt-4">
            You belong to {parlours.length} parlours. Showing the first one for now — a parlour
            switcher is coming soon.
          </p>
        )}
      </div>
    </div>
  );
}
