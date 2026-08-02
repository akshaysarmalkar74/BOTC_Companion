/**
 * Reminder Token library for Trouble Brewing.
 *
 * Each entry defines a token the Storyteller can manually place on any player.
 * Tokens are purely informational — the app never acts on them automatically.
 *
 * Future phases may programmatically add / remove tokens after night actions
 * by importing this library and using the key as a stable identifier.
 */

export interface ReminderTokenDef {
  key: string;          // stable identifier, e.g. 'monk-protected'
  label: string;        // display text, e.g. 'Protected'
  characterId: string;  // which character grants this token (matches Character.id)
  color: string;        // CSS color for the chip
}

export const REMINDER_TOKENS: ReminderTokenDef[] = [
  // ── Washerwoman ─────────────────────────────────────────────────────
  { key: 'washerwoman-townsfolk', label: 'Townsfolk', characterId: 'washerwoman', color: '#4a8fc7' },
  { key: 'washerwoman-wrong',     label: 'Wrong',     characterId: 'washerwoman', color: '#60607a' },
  // ── Librarian ───────────────────────────────────────────────────────
  { key: 'librarian-outsider',    label: 'Outsider',  characterId: 'librarian',   color: '#5aaa8a' },
  { key: 'librarian-wrong',       label: 'Wrong',     characterId: 'librarian',   color: '#60607a' },
  // ── Investigator ────────────────────────────────────────────────────
  { key: 'investigator-minion',   label: 'Minion',    characterId: 'investigator', color: '#c47a3a' },
  { key: 'investigator-wrong',    label: 'Wrong',     characterId: 'investigator', color: '#60607a' },
  // ── Fortune Teller ──────────────────────────────────────────────────
  { key: 'fortune-teller-red-herring', label: 'Red Herring', characterId: 'fortune-teller', color: '#c43a3a' },
  // ── Undertaker ──────────────────────────────────────────────────────
  { key: 'undertaker-investigated', label: 'Investigated', characterId: 'undertaker', color: '#9090d8' },
  // ── Monk ────────────────────────────────────────────────────────────
  { key: 'monk-protected',        label: 'Protected', characterId: 'monk',        color: '#4a8fc7' },
  // ── Virgin ──────────────────────────────────────────────────────────
  { key: 'virgin-ability-used',   label: 'Ability Used', characterId: 'virgin',   color: '#c4a45a' },
  // ── Slayer ──────────────────────────────────────────────────────────
  { key: 'slayer-used',           label: 'Used',      characterId: 'slayer',      color: '#c4a45a' },
  // ── Butler ──────────────────────────────────────────────────────────
  { key: 'butler-master',         label: 'Master',    characterId: 'butler',      color: '#5aaa8a' },
  // ── Drunk ───────────────────────────────────────────────────────────
  // Placed on the Townsfolk whose ability the Drunk thinks they have
  { key: 'drunk-is-drunk',        label: 'Is the Drunk', characterId: 'drunk',   color: '#c47a3a' },
  // ── Poisoner ────────────────────────────────────────────────────────
  { key: 'poisoner-poisoned',     label: 'Poisoned',  characterId: 'poisoner',    color: '#5aaa8a' },
];

/** Fast lookup: token_key → ReminderTokenDef */
export const TOKEN_BY_KEY = new Map(REMINDER_TOKENS.map((t) => [t.key, t]));

/**
 * Returns tokens grouped by characterId, in the same order as REMINDER_TOKENS.
 * Used by selection UIs to build grouped option lists.
 */
export function groupByCharacter(): Map<string, ReminderTokenDef[]> {
  const map = new Map<string, ReminderTokenDef[]>();
  for (const token of REMINDER_TOKENS) {
    const bucket = map.get(token.characterId) ?? [];
    bucket.push(token);
    map.set(token.characterId, bucket);
  }
  return map;
}
