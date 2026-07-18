// Mirrors backend/config/eventTypeConfig.js and frontend/src/config/eventTypeConfig.ts
// (identical shape, not shared code) — the single registry every conditional
// UI/validation branch reads instead of hardcoding `if (eventType === 'tournament')`
// checks. Adding a new event type that reuses existing sections is a one-line
// registry entry here, no branching code changes.
export const activityCategories = {
  sports: { label: 'Sports', activities: ['Football', 'Cricket', 'Basketball', 'Badminton', 'Karate', 'Taekwondo', 'Fitness', 'Custom'] },
  dance: { label: 'Dance', activities: ['Dance', 'Hip Hop', 'Classical Dance', 'Contemporary', 'Custom'] },
  performing_arts: { label: 'Performing Arts', activities: ['Music', 'Singing', 'Art', 'Custom'] },
  wellness: { label: 'Wellness', activities: ['Yoga', 'Custom'] },
  custom: { label: 'Other', activities: ['Custom'] },
} as const;

export const eventTypes = {
  tournament: { label: 'Tournament', category: 'sports', sections: ['sportFields'] },
  competition: { label: 'Competition', category: 'sports', sections: ['sportFields'] },
  championship: { label: 'Championship', category: 'sports', sections: ['sportFields'] },
  league_event: { label: 'League Event', category: 'sports', sections: ['sportFields'] },
  showcase: { label: 'Showcase', category: 'dance', sections: ['danceFields', 'performanceFields'] },
  performance: { label: 'Performance', category: 'dance', sections: ['danceFields', 'performanceFields'] },
  workshop: { label: 'Workshop', category: null, sections: ['workshopFields'] },
  camp: { label: 'Camp', category: null, sections: ['workshopFields'] },
  festival: { label: 'Festival', category: null, sections: [] },
  audition: { label: 'Audition', category: null, sections: ['performanceFields'] },
  exhibition: { label: 'Exhibition', category: null, sections: [] },
  custom: { label: 'Custom', category: null, sections: [] },
} as const;

export type ActivityCategoryKey = keyof typeof activityCategories;
export type EventTypeKey = keyof typeof eventTypes;

export function getSectionsForEventType(eventType: string): string[] {
  return (eventTypes as any)[eventType]?.sections || [];
}
