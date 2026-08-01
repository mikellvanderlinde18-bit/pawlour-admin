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
  // For now, default to the first parlour this user belongs to.
  // Once a parlour switcher exists, this becomes user-selectable instead of hardcoded to [0].
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

          <a
            href="/dashboard/hours"
            className="inline-block mt-4 mr-4 text-sm font-semibold text-[#14261F] underline"
          >
            Opening hours →
          </a>
          <a
            href="/dashboard/bookings"
            className="inline-block mt-4 mr-4 text-sm font-semibold text-[#14261F] underline"
          >
            New booking →
          </a>
          <a
            href="/dashboard/services"
            className="inline-block mt-4 mr-4 text-sm font-semibold text-[#14261F] underline"
          >
            Manage services &amp; pricing →
          </a>
          <a
            href="/dashboard/groomers"
            className="inline-block mt-4 text-sm font-semibold text-[#14261F] underline"
          >
            Manage groomers →
          </a>
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
