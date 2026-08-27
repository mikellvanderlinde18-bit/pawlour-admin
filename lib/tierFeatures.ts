export type Tier = "starter" | "growth" | "pro";

export const TIER_FEATURES: Record<
  Tier,
  {
    inAppPayments: boolean;
    rewards: boolean;
    offers: boolean;
    advancedReports: boolean;
    clientCap: number | null;
    showPawlourBadge: boolean;
    staffSeats: number;
  }
> = {
  starter: {
    inAppPayments: false,
    rewards: false,
    offers: false,
    advancedReports: false,
    clientCap: 100,
    showPawlourBadge: true,
    staffSeats: 1,
  },
  growth: {
    inAppPayments: true,
    rewards: true,
    offers: true,
    advancedReports: false,
    clientCap: null,
    showPawlourBadge: false,
    staffSeats: 3,
  },
  pro: {
    inAppPayments: true,
    rewards: true,
    offers: true,
    advancedReports: true,
    clientCap: null,
    showPawlourBadge: false,
    staffSeats: 10,
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};
