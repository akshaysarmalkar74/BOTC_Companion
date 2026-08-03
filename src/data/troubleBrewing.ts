import type { Character } from '../types';

/**
 * Complete Trouble Brewing character library.
 * Ability text is taken verbatim from the official character sheets.
 * Order within each team follows the official script sheet order.
 *
 * Metadata fields (firstNight, otherNights, etc.) are used by the rule engine,
 * night assistant, and validation layer — no logic should be hardcoded elsewhere.
 */
export const TROUBLE_BREWING: Character[] = [
  // ── Townsfolk ──────────────────────────────────────────────────────
  {
    id: 'washerwoman',
    name: 'Washerwoman',
    team: 'townsfolk',
    ability:
      'You start knowing that 1 of 2 players is a particular Townsfolk.',
    description:
      'On the first night, the Washerwoman learns that one of two specific players is a certain Townsfolk character — but not which of the two is that character. A Minion might be shown instead of the real Townsfolk to mislead.',
    firstNight:  true,
    otherNights: false,
    reminders: ['washerwoman-townsfolk', 'washerwoman-wrong'],
  },
  {
    id: 'librarian',
    name: 'Librarian',
    team: 'townsfolk',
    ability:
      'You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play)',
    description:
      'On the first night, the Librarian learns which of two players is a certain Outsider, or is told that no Outsiders are in play. Like the Washerwoman, a Minion could be falsely indicated.',
    firstNight:  true,
    otherNights: false,
    reminders: ['librarian-outsider', 'librarian-wrong'],
  },
  {
    id: 'investigator',
    name: 'Investigator',
    team: 'townsfolk',
    ability:
      'You start knowing that 1 of 2 players is a particular Minion.',
    description:
      'On the first night, the Investigator learns which of two players is a certain Minion. One of the two players shown is really that Minion, but the Investigator won\'t know which one without further deduction.',
    firstNight:  true,
    otherNights: false,
    reminders: ['investigator-minion', 'investigator-wrong'],
  },
  {
    id: 'chef',
    name: 'Chef',
    team: 'townsfolk',
    ability: 'You start knowing how many pairs of evil players there are.',
    description:
      'On the first night, the Chef learns a number: how many pairs of evil players are sitting next to each other around the circle. A "pair" means two evil players in adjacent seats. This helps identify clusters of evil.',
    firstNight:  true,
    otherNights: false,
  },
  {
    id: 'empath',
    name: 'Empath',
    team: 'townsfolk',
    ability:
      'Each night, you learn how many of your 2 alive neighbors are evil.',
    description:
      'Every night, the Empath is woken and shown a number (0, 1, or 2) representing how many of their two nearest living neighbours are evil. This information updates nightly as players die.',
    firstNight:  true,
    otherNights: true,
  },
  {
    id: 'fortune-teller',
    name: 'Fortune Teller',
    team: 'townsfolk',
    ability:
      'Each night, choose 2 players: you learn if either is a Demon. There is a good player that registers as a Demon to you.',
    description:
      'Each night, the Fortune Teller points to two players and learns whether either is the Demon. However, one good player in the game permanently registers as the Demon to the Fortune Teller, creating deliberate false positives.',
    firstNight:  true,
    otherNights: true,
    reminders: ['fortune-teller-red-herring'],
  },
  {
    id: 'undertaker',
    name: 'Undertaker',
    team: 'townsfolk',
    ability:
      'Each night\u002A, you learn which character died by execution today.',
    description:
      'Each night after an execution has occurred, the Undertaker is woken and shown the character token of the player who was executed that day. The asterisk (*) means this ability does not trigger on the first night.',
    firstNight:  false,
    otherNights: true,
    reminders: ['undertaker-investigated'],
  },
  {
    id: 'monk',
    name: 'Monk',
    team: 'townsfolk',
    ability:
      'Each night\u002A, choose a player (not yourself): they are safe from the Demon tonight.',
    description:
      'Each night after the first, the Monk chooses one player (not themselves) to protect. That player cannot be killed by the Demon that night. The Monk\'s protection is absolute unless abilities interfere.',
    firstNight:  false,
    otherNights: true,
    reminders: ['monk-protected'],
  },
  {
    id: 'ravenkeeper',
    name: 'Ravenkeeper',
    team: 'townsfolk',
    ability:
      'If you die at night, you are woken to choose a player: you learn their character.',
    description:
      'If the Ravenkeeper is killed by the Demon at night, they immediately wake up and choose any player. The Storyteller reveals that player\'s character to the Ravenkeeper before they die.',
    firstNight:  false,
    otherNights: false,
    wakeOnDeath: true,
  },
  {
    id: 'virgin',
    name: 'Virgin',
    team: 'townsfolk',
    ability:
      'The 1st time you are nominated, if the nominator is a Townsfolk, they are executed immediately.',
    description:
      'The first time the Virgin is nominated for execution, if the nominating player is a Townsfolk character, that nominator is immediately executed without a vote. This ability is one-time and does not fire for subsequent nominations.',
    firstNight:   false,
    otherNights:  false,
    isOncePerGame: true,
    hasDayAbility: true,
    reminders: ['virgin-ability-used'],
  },
  {
    id: 'slayer',
    name: 'Slayer',
    team: 'townsfolk',
    ability:
      'Once per game, during the day, publicly choose a player: if they are the Demon, they die.',
    description:
      'During the day, the Slayer may publicly declare they are "slaying" a player. If that player is the Demon, they die instantly. If not, nothing happens. This ability can only be used once per game and must be done openly.',
    firstNight:   false,
    otherNights:  false,
    isOncePerGame: true,
    hasDayAbility: true,
    reminders: ['slayer-used'],
  },
  {
    id: 'soldier',
    name: 'Soldier',
    team: 'townsfolk',
    ability: 'You are safe from the Demon.',
    description:
      'The Soldier cannot be killed by the Demon at night. The Demon\'s attack simply fails when targeting the Soldier. This protection is permanent and passive — no nightly action required.',
    firstNight:  false,
    otherNights: false,
  },
  {
    id: 'mayor',
    name: 'Mayor',
    team: 'townsfolk',
    ability:
      'If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.',
    description:
      'The Mayor has two abilities: if exactly 3 players remain alive and no execution happens that day, the good team wins immediately. Additionally, if the Demon tries to kill the Mayor, the Storyteller may redirect the kill to another player.',
    firstNight:   false,
    otherNights:  false,
    hasDayAbility: true,
  },

  // ── Outsiders ──────────────────────────────────────────────────────
  {
    id: 'butler',
    name: 'Butler',
    team: 'outsider',
    ability:
      'Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.',
    description:
      'Each night, the Butler secretly chooses a master. The following day, the Butler may only raise their hand to vote if their chosen master votes for the same execution. The Butler cannot vote independently.',
    firstNight:  true,
    otherNights: true,
    reminders: ['butler-master'],
  },
  {
    id: 'drunk',
    name: 'Drunk',
    team: 'outsider',
    ability:
      'You do not know you are the Drunk. You think you are a Townsfolk character, but you are not.',
    description:
      'The Drunk is told they are a Townsfolk character and believes it — but their ability never works. The Storyteller gives them false information as if they had that Townsfolk\'s ability. The Drunk is always sober from their own perspective.',
    firstNight:  false,
    otherNights: false,
    isSetup:     true,
    reminders:   ['drunk-is-drunk'],
  },
  {
    id: 'recluse',
    name: 'Recluse',
    team: 'outsider',
    ability:
      'You might register as evil & as a Minion or Demon, even if dead.',
    description:
      'The Recluse may register as evil or as a specific evil character to detection abilities, even while dead. The Storyteller decides when and whether the Recluse misregisters, making them a wildcard for information-gathering Townsfolk.',
    firstNight:  false,
    otherNights: false,
  },
  {
    id: 'saint',
    name: 'Saint',
    team: 'outsider',
    ability: 'If you die by execution, your team loses.',
    description:
      'If the Saint is executed by the town, the good team immediately loses the game. The Saint is a liability — good players must avoid executing them, and evil players will try to make the Saint look suspicious.',
    firstNight:   false,
    otherNights:  false,
    hasDayAbility: true,
  },

  // ── Minions ────────────────────────────────────────────────────────
  {
    id: 'poisoner',
    name: 'Poisoner',
    team: 'minion',
    ability:
      'Each night, choose a player: they are poisoned tonight and tomorrow day.',
    description:
      'The Poisoner wakes each night to poison one player. A poisoned player\'s ability malfunctions for that night and the following day — they may receive false information or have their protection fail. The poison wears off the following night.',
    firstNight:  true,
    otherNights: true,
    reminders:   ['poisoner-poisoned'],
  },
  {
    id: 'spy',
    name: 'Spy',
    team: 'minion',
    ability:
      'Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.',
    description:
      'Each night, the Spy sees the Storyteller\'s Grimoire — the complete record of who has which character, reminder tokens, and game state. The Spy may also register as good or as a specific good character to detection abilities.',
    firstNight:  true,
    otherNights: true,
  },
  {
    id: 'scarlet-woman',
    name: 'Scarlet Woman',
    team: 'minion',
    ability:
      'If there are 5 or more players alive & the Demon dies, you become the Demon. (Travellers don\'t count.)',
    description:
      'If the Demon is executed or killed while 5 or more players remain alive (excluding Travellers), the Scarlet Woman immediately and secretly becomes the Imp. The game continues as if the Demon had not died.',
    firstNight:  false,
    otherNights: true,
  },
  {
    id: 'baron',
    name: 'Baron',
    team: 'minion',
    ability: 'There are extra Outsiders in play. [+2 Outsiders]',
    description:
      'When the Baron is in the game, two extra Outsiders are added to the character bag and two Townsfolk are removed. This happens during setup before the game begins. The Baron has no nightly ability.',
    firstNight:  false,
    otherNights: false,
    isSetup:     true,
  },

  // ── Demons ─────────────────────────────────────────────────────────
  {
    id: 'imp',
    name: 'Imp',
    team: 'demon',
    ability:
      'Each night\u002A, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.',
    description:
      'The Imp kills one player each night after the first. If the Imp chooses to kill themselves, they die and one Minion of the Storyteller\'s choice becomes the new Imp — effectively passing the Demon role to continue the evil team\'s game.',
    firstNight:  false,
    otherNights: true,
  },
];
