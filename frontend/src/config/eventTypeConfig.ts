// Mirrors backend/config/eventTypeConfig.js exactly (shared shape, not shared
// code — keep the two in lockstep when adding event types/activities).
export const activityCategories = {
  sports: { label: "Sports", activities: ["Football", "Cricket", "Basketball", "Badminton", "Karate", "Taekwondo", "Fitness", "Custom"] },
  dance: { label: "Dance", activities: ["Dance", "Hip Hop", "Classical Dance", "Contemporary", "Custom"] },
  performing_arts: { label: "Performing Arts", activities: ["Music", "Singing", "Art", "Custom"] },
  wellness: { label: "Wellness", activities: ["Yoga", "Custom"] },
  custom: { label: "Other", activities: ["Custom"] },
} as const;

export const eventTypes = {
  tournament: { label: "Tournament", category: "sports", sections: ["sportFields"] },
  competition: { label: "Competition", category: "sports", sections: ["sportFields"] },
  championship: { label: "Championship", category: "sports", sections: ["sportFields"] },
  league_event: { label: "League Event", category: "sports", sections: ["sportFields"] },
  showcase: { label: "Showcase", category: "dance", sections: ["danceFields", "performanceFields"] },
  performance: { label: "Performance", category: "dance", sections: ["danceFields", "performanceFields"] },
  workshop: { label: "Workshop", category: null, sections: ["workshopFields"] },
  camp: { label: "Camp", category: null, sections: ["workshopFields"] },
  festival: { label: "Festival", category: null, sections: [] },
  audition: { label: "Audition", category: null, sections: ["performanceFields"] },
  exhibition: { label: "Exhibition", category: null, sections: [] },
  custom: { label: "Custom", category: null, sections: [] },
} as const;

export type EventTypeKey = keyof typeof eventTypes;
export type ActivityCategoryKey = keyof typeof activityCategories;

export function getSectionsForEventType(eventType: string): string[] {
  return (eventTypes as any)[eventType]?.sections || [];
}

export function getCategoryForEventType(eventType: string): string | null {
  return (eventTypes as any)[eventType]?.category ?? null;
}

// Best-effort: given a free-typed `activity` string, find which category it
// belongs to — mirrors the backend's fallback used when the event type
// itself doesn't pin a category (e.g. workshop/festival/custom).
export function getCategoryForActivity(activity: string): string | null {
  if (!activity) return null;
  const normalized = activity.trim().toLowerCase();
  for (const [key, cfg] of Object.entries(activityCategories)) {
    if ((cfg.activities as readonly string[]).some((a) => a.toLowerCase() === normalized)) return key;
  }
  return null;
}

// Client-side best-effort resolution of activityCategory for a given
// {eventType, activity} pair, mirroring the server's denormalization order:
// event type's pinned category first, else inferred from the activity text.
export function resolveActivityCategory(eventType: string, activity: string): string | null {
  return getCategoryForEventType(eventType) ?? getCategoryForActivity(activity);
}
