"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number | null;
  audience: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export default function OffersPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [audience, setAudience] = useState<"all" | "lapsed" | "loyal">("all");
  const [endsAt, setEndsAt] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase.from("parlour_staff").select("parlour_id").eq("auth_user_id", user.id).limit(1).maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }
    setParlourId(staffRow.parlour_id);

    const { data: offerRows } = await supabase
      .from("offer")
      .select("id, title, description, discount_percent, audience, starts_at, ends_at, created_at")
      .eq("parlour_id", staffRow.parlour_id)
      .order("created_at", { ascending: false });

    setOffers(offerRows ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parlourId || !title.trim()) return;
    setSaving(true);

    const { error: createError } = await supabase.from("offer").insert({
      parlour_id: parlourId,
      title: title.trim(),
      description: description.trim() || null,
      discount_percent: discountPercent || null,
      audience,
      starts_at: new Date().toISOString(),
      ends_at: endsAt || null,
    });

    setSaving(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    setTitle("");
    setDescription("");
    setDiscountPercent("");
    setAudience("all");
    setEndsAt("");
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this offer?")) return;
    await supabase.from("offer").delete().eq("id", id);
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] px-6 py-10 flex items-center justify-center">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Offers</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">Deals and specials your clients will see in their app.</p>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>}

        <div className="space-y-3 mb-8">
          {offers.length === 0 && <p className="text-sm text-[#14261F]/50 italic">No offers yet.</p>}
          {offers.map((offer) => (
            <div key={offer.id} className="bg-white border border-black/10 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#14261F]">{offer.title}</span>
                  {offer.discount_percent && (
                    <span className="text-[10px] font-medium bg-[#FAF6EF] text-[#D98F5F] px-2 py-0.5 rounded-full">
                      {Number(offer.discount_percent)}% off
                    </span>
                  )}
                </div>
                {offer.description && <p className="text-xs text-[#14261F]/60 mb-1">{offer.description}</p>}
                <p className="text-xs text-[#14261F]/40 capitalize">
                  {offer.audience === "all" ? "All clients" : offer.audience}
                  {offer.ends_at && ` · ends ${new Date(offer.ends_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
                </p>
              </div>
              <button onClick={() => handleDelete(offer.id)} className="text-xs text-red-500 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#14261F]">Create an offer</h2>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Spring wash special"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#14261F] mb-1">Discount % (optional)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#14261F] mb-1">Ends on (optional)</label>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#14261F] mb-1">Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]">
              <option value="all">All clients</option>
              <option value="lapsed">Haven&apos;t booked in a while</option>
              <option value="loyal">Loyal / repeat clients</option>
            </select>
          </div>

          <button type="submit" disabled={saving} className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Create offer"}
          </button>
        </form>
      </div>
    </div>
  );
}
