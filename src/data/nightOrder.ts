import { TROUBLE_BREWING } from './troubleBrewing';
import type { Player } from '../types';

export interface AutoReminder {
  /** Key of the token to place (references ReminderTokenDef.key) */
  tokenKey: string;
  /** Which index of target_ids this token is placed on */
  targetIndex: number;
}

export interface NightStepDef {
  key: string;
  label: string;
  /** null for setup steps (minion-info, demon-info) */
  characterId: string | null;
  firstNight: boolean;
  otherNights: boolean;
  /** Storyteller instruction text */
  instruction: string;
  /** Number of players the ST must select (0 = info-only step) */
  targetCount: 0 | 1 | 2;
  /**
   * Reminder tokens to auto-place after the ST presses Done.
   * Existing tokens with the same key are removed first (e.g. Monk moves the
   * Protected token to a new player each night).
   */
  autoReminders: AutoReminder[];
  /**
   * Skip this step when the character's player is dead.
   * False for Ravenkeeper — they wake specifically when dead.
   */
  skipWhenDead: boolean;
  /**
   * Step may not apply every night. Show a warning so the ST can skip
   * if it doesn't apply (e.g. Undertaker only acts if someone was executed).
   */
  conditional: boolean;

  // ── Targeting rules ─────────────────────────────────────────────────────
  /**
   * Whether the acting character may target themselves.
   * Defaults to false. Imp is the only TB character that may self-target.
   */
  selfAllowed?: boolean;
  /**
   * Whether dead players are valid targets.
   * Defaults to false. Ravenkeeper's choice allows dead targets.
   */
  deadAllowed?: boolean;
  /**
   * When targetCount === 2, both selected players must be different.
   * Defaults to true when targetCount === 2.
   * Fortune Teller, Washerwoman, Librarian, Investigator all require 2 distinct players.
   */
  targetsMustDiffer?: boolean;
  /**
   * Token key that marks "this ability has been used" for once-per-game enforcement.
   * If the acting player has this token, the engine emits a validation warning.
   */
  oncePerGameToken?: string;

  /**
   * When set, show a role-picker for this alignment so the ST can record
   * which role token they showed to the player (Washerwoman / Librarian / Investigator).
   */
  roleRevealTeam?: 'townsfolk' | 'outsider' | 'minion';

  /**
   * Mark the Demon Info step so the UI shows the bluff role picker (3 roles not in play).
   */
  isDemonInfo?: boolean;
}

// ── Official Trouble Brewing night steps ────────────────────────────────────

export const NIGHT_STEPS: NightStepDef[] = [
  // ── Setup (first night only) ────────────────────────────────────────
  {
    key: 'minion-info',
    label: 'Minion Info',
    characterId: null,
    firstNight: true, otherNights: false,
    instruction:
      'Wake all Minions. Let them open their eyes and look around to see each ' +
      'other and who the Demon is. Show them the Demon player. Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: false,
    conditional: false,
  },
  {
    key: 'demon-info',
    label: 'Demon Info',
    characterId: null,
    firstNight: true, otherNights: false,
    instruction:
      'Wake the Demon. Show them their Minion players. ' +
      'Show them 3 role tokens not in play to use as bluffs. Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: false,
    conditional: false,
    isDemonInfo: true,
  },
  // ── Characters ──────────────────────────────────────────────────────
  {
    key: 'poisoner',
    label: 'Poisoner',
    characterId: 'poisoner',
    firstNight: true, otherNights: true,
    instruction:
      'Wake the Poisoner. They point to any player. That player is poisoned ' +
      'tonight and tomorrow day — their ability does not work. Put them back to sleep.',
    targetCount: 1,
    autoReminders: [{ tokenKey: 'poisoner-poisoned', targetIndex: 0 }],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: true,    // Poisoner may poison themselves (unusual but allowed)
    deadAllowed: false,
  },
  {
    key: 'washerwoman',
    label: 'Washerwoman',
    characterId: 'washerwoman',
    firstNight: true, otherNights: false,
    instruction:
      'Wake the Washerwoman. Show them 2 players — one is a specific Townsfolk ' +
      'of your choosing, the other is any other player. Show the Townsfolk\'s role token. ' +
      'Put them back to sleep.',
    targetCount: 2,
    autoReminders: [
      { tokenKey: 'washerwoman-townsfolk', targetIndex: 0 },
      { tokenKey: 'washerwoman-wrong',     targetIndex: 1 },
    ],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,
    deadAllowed: false,
    targetsMustDiffer: true,
    roleRevealTeam: 'townsfolk',
  },
  {
    key: 'librarian',
    label: 'Librarian',
    characterId: 'librarian',
    firstNight: true, otherNights: false,
    instruction:
      'Wake the Librarian. Show them 2 players — one is a specific Outsider ' +
      'of your choosing (or show "0" if none are in play), the other is any other player. ' +
      'Show the Outsider\'s role token. Put them back to sleep.',
    targetCount: 2,
    autoReminders: [
      { tokenKey: 'librarian-outsider', targetIndex: 0 },
      { tokenKey: 'librarian-wrong',    targetIndex: 1 },
    ],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,
    deadAllowed: false,
    targetsMustDiffer: true,
    roleRevealTeam: 'outsider',
  },
  {
    key: 'investigator',
    label: 'Investigator',
    characterId: 'investigator',
    firstNight: true, otherNights: false,
    instruction:
      'Wake the Investigator. Show them 2 players — one is a specific Minion ' +
      'of your choosing, the other is any other player. Show the Minion\'s role token. ' +
      'Put them back to sleep.',
    targetCount: 2,
    autoReminders: [
      { tokenKey: 'investigator-minion', targetIndex: 0 },
      { tokenKey: 'investigator-wrong',  targetIndex: 1 },
    ],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,
    deadAllowed: false,
    targetsMustDiffer: true,
    roleRevealTeam: 'minion',
  },
  {
    key: 'chef',
    label: 'Chef',
    characterId: 'chef',
    firstNight: true, otherNights: false,
    instruction:
      'Wake the Chef. Show them a number of fingers equal to how many pairs of ' +
      'adjacent evil players sit next to each other around the circle. ' +
      'Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: true,
    conditional: false,
  },
  {
    key: 'empath',
    label: 'Empath',
    characterId: 'empath',
    firstNight: true, otherNights: true,
    instruction:
      'Wake the Empath. Show them 0, 1, or 2 fingers — the number of their ' +
      'currently living neighbours who are evil. Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: true,
    conditional: false,
  },
  {
    key: 'fortune-teller',
    label: 'Fortune Teller',
    characterId: 'fortune-teller',
    firstNight: true, otherNights: true,
    instruction:
      'Wake the Fortune Teller. They point to any 2 players. Nod "Yes" if ' +
      'either player is the Demon (or the Red Herring). Shake "No" otherwise. ' +
      'Put them back to sleep.',
    targetCount: 2,
    autoReminders: [],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,
    deadAllowed: false,
    targetsMustDiffer: true,
  },
  {
    key: 'butler',
    label: 'Butler',
    characterId: 'butler',
    firstNight: true, otherNights: true,
    instruction:
      'Wake the Butler. They point to any player (not themselves). That player ' +
      'is their Master tonight — the Butler may only vote if their Master votes first. ' +
      'Put them back to sleep.',
    targetCount: 1,
    autoReminders: [{ tokenKey: 'butler-master', targetIndex: 0 }],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,  // Butler cannot choose themselves as master
    deadAllowed: false,
  },
  {
    key: 'spy',
    label: 'Spy',
    characterId: 'spy',
    firstNight: true, otherNights: true,
    instruction:
      'Wake the Spy. Show them the Grimoire (all roles, alive/dead status, ' +
      'and reminder tokens). Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: true,
    conditional: false,
  },
  {
    key: 'monk',
    label: 'Monk',
    characterId: 'monk',
    firstNight: false, otherNights: true,
    instruction:
      'Wake the Monk. They point to any player (not themselves). That player ' +
      'is protected from the Demon tonight. Put them back to sleep.',
    targetCount: 1,
    autoReminders: [{ tokenKey: 'monk-protected', targetIndex: 0 }],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: false,  // Monk cannot protect themselves
    deadAllowed: false,
  },
  {
    key: 'scarlet-woman',
    label: 'Scarlet Woman',
    characterId: 'scarlet-woman',
    firstNight: false, otherNights: true,
    instruction:
      'If the Imp just killed themselves, wake the Scarlet Woman. ' +
      'Show them the Imp role token — they are now the Imp. Put them back to sleep.',
    targetCount: 0,
    autoReminders: [],
    skipWhenDead: true,
    conditional: true,
  },
  {
    key: 'imp',
    label: 'Imp',
    characterId: 'imp',
    firstNight: false, otherNights: true,
    instruction:
      'Wake the Imp. They point to any player. That player dies tonight. ' +
      'If they point to themselves, they die and the Scarlet Woman (if in play) ' +
      'becomes the new Imp. Put them back to sleep.',
    targetCount: 1,
    autoReminders: [],
    skipWhenDead: true,
    conditional: false,
    selfAllowed: true,   // Imp can choose themselves (self-star)
    deadAllowed: false,
  },
  {
    key: 'ravenkeeper',
    label: 'Ravenkeeper',
    characterId: 'ravenkeeper',
    firstNight: false, otherNights: true,
    instruction:
      'If the Ravenkeeper died tonight, wake them. They point to any player. ' +
      'Show them that player\'s role token. Put them back to sleep.',
    targetCount: 1,
    autoReminders: [],
    skipWhenDead: false, // wakes specifically when dead
    conditional: true,
    selfAllowed: false,
    deadAllowed: true,   // Ravenkeeper may choose dead players
  },
  {
    key: 'undertaker',
    label: 'Undertaker',
    characterId: 'undertaker',
    firstNight: false, otherNights: true,
    instruction:
      'If a player was executed yesterday, wake the Undertaker. ' +
      'Show them the role token of the executed player. Put them back to sleep.',
    targetCount: 1,
    autoReminders: [{ tokenKey: 'undertaker-investigated', targetIndex: 0 }],
    skipWhenDead: true,
    conditional: true,
    selfAllowed: false,
    deadAllowed: true,   // Undertaker target is necessarily the dead executed player
  },
];

// ── Night orders (official Trouble Brewing sequence) ────────────────────────

export const FIRST_NIGHT_ORDER: string[] = [
  'minion-info', 'demon-info', 'poisoner', 'washerwoman', 'librarian',
  'investigator', 'chef', 'empath', 'fortune-teller', 'butler', 'spy',
];

export const OTHER_NIGHT_ORDER: string[] = [
  'poisoner', 'monk', 'scarlet-woman', 'imp', 'ravenkeeper',
  'undertaker', 'empath', 'fortune-teller', 'butler', 'spy',
];

const STEP_BY_KEY = new Map(NIGHT_STEPS.map((s) => [s.key, s]));

/**
 * Build the ordered list of active steps for a given night.
 *
 * Filters out:
 *   - Characters not in the script
 *   - Steps that don't apply to this night type (first vs. other)
 *   - Dead players for steps with skipWhenDead: true
 *
 * Conditional steps (Ravenkeeper, Undertaker, Scarlet Woman) are included
 * with a flag so the UI can show a warning.
 */
export function computeActiveSteps(
  scriptIds: string[],
  players: Player[],
  isFirstNight: boolean
): NightStepDef[] {
  const order = isFirstNight ? FIRST_NIGHT_ORDER : OTHER_NIGHT_ORDER;
  const scriptSet = new Set(scriptIds);
  const steps: NightStepDef[] = [];

  for (const key of order) {
    const def = STEP_BY_KEY.get(key);
    if (!def) continue;

    // Setup steps: include if relevant team is in the script
    if (def.key === 'minion-info') {
      if (TROUBLE_BREWING.some((c) => c.team === 'minion' && scriptSet.has(c.id))) {
        steps.push(def);
      }
      continue;
    }
    if (def.key === 'demon-info') {
      if (TROUBLE_BREWING.some((c) => c.team === 'demon' && scriptSet.has(c.id))) {
        steps.push(def);
      }
      continue;
    }

    // Character steps: must be in the script
    if (!def.characterId || !scriptSet.has(def.characterId)) continue;

    // Skip dead players where the character doesn't benefit from waking when dead
    if (def.skipWhenDead) {
      const player = players.find((p) => p.role === def.characterId);
      if (player && !player.is_alive) continue;
    }

    steps.push(def);
  }

  return steps;
}

/** Extract the night number from the phase string ("Night 2" → 2, "Day 1" → 1). */
export function getNightNumber(phase: string): number {
  const m = phase.match(/^(?:Night|Day) (\d+)$/);
  return m ? parseInt(m[1]) : 1;
}
