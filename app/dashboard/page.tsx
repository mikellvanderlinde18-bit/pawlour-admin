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

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#14261F] mb-1">
          {parlour ? parlour.name : "Dashboard"}
        </h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Signed in as {user.email} · role: {staffRow?.role ?? "unknown"}
        </p>

        {parlour ? (
          <>
            <div className="bg-white border border-black/10 rounded-2xl p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[#14261F]/50">Subdomain</div>
                <div className="font-medium text-[#14261F]">{parlour.subdomain}.pawlour.app</div>
              </div>
              <div>
                <div className="text-[#14261F]/50">Tier</div>
                <div className="font-medium text-[#14261F] capitalize">{parlour.tier}</div>
              </div>
              <div>
                <div className="text-[#14261F]/50">Status</div>
                <div className="font-medium text-[#14261F] capitalize">{parlour.status}</div>
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

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              <a href="/dashboard/bookings" className="text-sm font-semibold text-[#14261F] underline">
                Bookings →
              </a>
              <a href="/dashboard/bookings/new" className="text-sm font-semibold text-[#14261F] underline">
                New booking →
              </a>
              <a href="/dashboard/services" className="text-sm font-semibold text-[#14261F] underline">
                Manage services &amp; pricing →
              </a>
              <a href="/dashboard/groomers" className="text-sm font-semibold text-[#14261F] underline">
                Manage groomers →
              </a>
              <a href="/dashboard/hours" className="text-sm font-semibold text-[#14261F] underline">
                Opening hours →
              </a>
              <a href="/dashboard/rewards" className="text-sm font-semibold text-[#14261F] underline">
                Rewards →
              </a>
              <a href="/dashboard/offers" className="text-sm font-semibold text-[#14261F] underline">
                Offers →
              </a>
              <a href="/dashboard/reports" className="text-sm font-semibold text-[#14261F] underline">
                Reports →
              </a>
              <a href="/dashboard/branding" className="text-sm font-semibold text-[#14261F] underline">
                Branding →
              </a>
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

        <p className="text-xs text-[#14261F]/40 mt-8">
          This confirms login, session, and RLS-protected data access are all working end to end.
        </p>
      </div>
    </div>
  );
}
