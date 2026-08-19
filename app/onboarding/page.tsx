"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const subdomain = useMemo(() => slugify(name), [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to be signed in to set up a parlour.");
      setLoading(false);
      return;
    }

    if (!subdomain) {
      setError("Please enter a parlour name.");
      setLoading(false);
      return;
    }

    const { data: parlour, error: parlourError } = await supabase
      .from("parlour")
      .insert({
        name,
        subdomain,
        contact_email: contactEmail || user.email,
        contact_phone: contactPhone || null,
        address: address || null,
        tier: "starter",
        status: "trial",
      })
      .select("id")
      .single();

    if (parlourError || !parlour) {
      setError(
        parlourError?.message.includes("duplicate")
          ? "That parlour name is already taken — try a slightly different name."
          : parlourError?.message ?? "Something went wrong creating your parlour."
      );
      setLoading(false);
      return;
    }

    const { error: staffError } = await supabase.from("parlour_staff").insert({
      parlour_id: parlour.id,
      auth_user_id: user.id,
      role: "owner",
    });

    setLoading(false);

    if (staffError) {
      setError(staffError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#D98F5F] mb-2">
            Step 1 of 7 · Business basics
          </div>
          <h1 className="text-2xl font-semibold text-[#14261F]">Tell us about your parlour</h1>
          <p className="text-sm text-[#14261F]/60 mt-1">This sets up your booking page and dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Parlour name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="e.g. Le Perky Pooch"
            />
            {subdomain && (
              <p className="text-xs text-[#14261F]/50 mt-1.5">
                Your booking link will be <span className="font-medium text-[#14261F]">{subdomain}.pawlour.app</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Contact email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="Defaults to your login email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Contact phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="e.g. 082 123 4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="Street, suburb, city"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Creating your parlour…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
