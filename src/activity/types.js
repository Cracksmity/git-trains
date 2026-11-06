/**
 * Values exchanged by GitHub adapters, activity rules and renderers.
 * @typedef {{ date: string, count: number }} ActivityDay
 * @typedef {{ name: string, bytes: number, color?: string }} ActivityLanguage
 * @typedef {'idle' | 'slow' | 'normal' | 'fast'} TrainState
 * @typedef {{ user: string, days: ActivityDay[], languages: ActivityLanguage[], kind?: 'repo', fullName?: string, seed?: string }} Activity
 * @typedef {ActivityLanguage & { color: string, share: number }} RankedLanguage
 * @typedef {{ user: string, days: ActivityDay[], languages: RankedLanguage[], total: number, yesterday: number, streak: number, cars: number, state: TrainState, kind?: 'repo', fullName?: string, seed?: string }} ActivityStats
 */
export {};
