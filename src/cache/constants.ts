// ABOUTME: Shared cache TTL constants for Worker and KV caches
// Provides evergreen time unit helpers and standard TTL presets

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const YEAR = 365 * DAY;

// Long TTL for versioned immutable data
export const MAX_TTL = YEAR; // 1 year

// Short TTL for unversioned or preview/editor data
export const SHORT_TTL = 5 * SECOND; // 5 seconds
