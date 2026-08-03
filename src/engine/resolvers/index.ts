/**
 * Resolver registry
 *
 * All role resolvers for Trouble Brewing are registered here.
 * To add a new script: import its resolvers and add them to RESOLVER_REGISTRY.
 *
 * The pipeline imports from this file — it never imports individual resolvers.
 */

import type { RoleResolver } from './types';
import { MonkResolver } from './monk';
import { ImpResolver } from './imp';
import { PoisonerResolver } from './poisoner';
import { ScarletWomanResolver } from './scarletWoman';
import { FortuneTellerResolver } from './fortuneTeller';
import { UndertakerResolver } from './undertaker';
import { RavenkeeperResolver } from './ravenkeeper';
import {
  ChefResolver,
  EmpathResolver,
  WasherwomanResolver,
  LibrarianResolver,
  InvestigatorResolver,
} from './infoRoles';
import { ButlerResolver, RecluseResolver, SpyResolver } from './passive';

export const RESOLVER_REGISTRY: RoleResolver[] = [
  // Layer 2 — Role Resolver
  // Order here reflects pipeline stage grouping, not night wake order.
  // The pipeline decides which resolvers to call and when.

  // Poison stage
  PoisonerResolver,

  // Protection stage
  MonkResolver,

  // Death stage
  ImpResolver,

  // Transform stage (Demon succession)
  ScarletWomanResolver,

  // Triggered abilities (after deaths are resolved)
  RavenkeeperResolver,

  // Information roles
  ChefResolver,
  EmpathResolver,
  WasherwomanResolver,
  LibrarianResolver,
  InvestigatorResolver,
  FortuneTellerResolver,
  UndertakerResolver,

  // Advisory / passive roles
  ButlerResolver,
  RecluseResolver,
  SpyResolver,
];

/** Fast lookup: characterId → resolver */
export const RESOLVER_BY_ID = new Map<string, RoleResolver>(
  RESOLVER_REGISTRY.map((r) => [r.characterId, r]),
);
