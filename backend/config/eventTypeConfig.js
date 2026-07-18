// Single source of truth for which activities belong to which category, and
// which event types show which conditional form sections. Mirrored (same
// shape, not shared code) in frontend/src/config/eventTypeConfig.ts and
// NestSports/src/config/eventTypeConfig.ts — keep all three in lockstep.
//
// Adding a brand new event type that reuses existing sections is a one-line
// addition to `eventTypes` below — no controller/validation branching needed
// anywhere else in the codebase.

const activityCategories = {
  sports: {
    label: "Sports",
    activities: [
      "Football",
      "Cricket",
      "Basketball",
      "Badminton",
      "Karate",
      "Taekwondo",
      "Fitness",
      "Custom",
    ],
  },
  dance: {
    label: "Dance",
    activities: [
      "Dance",
      "Hip Hop",
      "Classical Dance",
      "Contemporary",
      "Custom",
    ],
  },
  performing_arts: {
    label: "Performing Arts",
    activities: ["Music", "Singing", "Art", "Custom"],
  },
  wellness: {
    label: "Wellness",
    activities: ["Yoga", "Custom"],
  },
  custom: {
    label: "Other",
    activities: ["Custom"],
  },
};

// `sections` names the conditional field-groups (sportFields/danceFields/
// workshopFields/performanceFields) an event type surfaces in forms and
// validation, on top of the always-present common/venue/schedule/
// participation/categories/fees/awards/officials/automation sections.
const eventTypes = {
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
};

function getSectionsForEventType(eventType) {
  return eventTypes[eventType]?.sections || [];
}

function getCategoryForEventType(eventType) {
  return eventTypes[eventType]?.category || null;
}

// Best-effort: given a free-typed `activity` string, find which category it
// belongs to (used server-side to set the denormalized `activityCategory`
// cache on save when the event type itself doesn't pin one, e.g. workshop).
function getCategoryForActivity(activity) {
  if (!activity) return null;
  const normalized = String(activity).trim().toLowerCase();
  for (const [key, cfg] of Object.entries(activityCategories)) {
    if (cfg.activities.some((a) => a.toLowerCase() === normalized)) return key;
  }
  return null;
}

module.exports = {
  activityCategories,
  eventTypes,
  getSectionsForEventType,
  getCategoryForEventType,
  getCategoryForActivity,
};
