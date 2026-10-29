/** Couleurs des traces de vie du matériel (la trace « rouge » est rose) */
export const LIFE_TRACE_COLORS = { red: '#e5197e', yellow: '#e8a21a', blue: '#1ea7e8' } as const;
export type LifeTraceColor = keyof typeof LIFE_TRACE_COLORS;
