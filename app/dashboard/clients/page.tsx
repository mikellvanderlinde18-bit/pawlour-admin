"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Dog = { id: string; name: string; species: string; breed: string | null; photo_url: string | null };
type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  dog: Dog[];
};

export default function ClientsPage() {
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase
      .from("parlour_staff")
      .select("parlour_id")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    const { data: clientRows } = await supabase
      .from("client")
      .select("id, name, email, phone, created_at, dog(id, name, species, breed, photo_url)")
      .eq("parlour_id", staffRow.parlour_id)
      .order("name");

    setClients((clientRows ?? []) as unknown as Client[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.dog.some((d) => d.name.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-[#14261F] mb-1">Clients</h1>
        <p className="text-sm text-[#14261F]/60 mb-6">Everyone who&apos;s signed up, and their pets.</p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, phone, or pet name…"
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] mb-6 bg-white"
        />

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-[#14261F]/50 italic">
              {clients.length === 0 ? "No clients yet — they'll appear here once someone signs up to book." : "No matches."}
            </p>
          )}
          {filtered.map((client) => (
            <div key={client.id} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-[#14261F] text-sm">{client.name}</p>
                  <p className="text-xs text-[#14261F]/50">
                    {client.phone ?? "No phone"}
                    {client.email ? ` · ${client.email}` : ""}
                  </p>
                </div>
                <p className="text-xs text-[#14261F]/40">
                  Joined{" "}
                  {new Date(client.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {client.dog.length === 0 ? (
                <p className="text-xs text-[#14261F]/40 italic">No pets on file yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {client.dog.map((pet) => (
                    <div
                      key={pet.id}
                      className="flex items-center gap-2 bg-[#FAF6EF] rounded-full pl-1 pr-3 py-1"
                    >
                      <div className="w-6 h-6 rounded-full bg-white border border-black/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {pet.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px]">{pet.species === "cat" ? "🐱" : "🐾"}</span>
                        )}
                      </div>
                      <span className="text-xs text-[#14261F]">
                        {pet.name}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
