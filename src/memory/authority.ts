import { normalizeScope } from "./diagnostics.js";
import type { MemoryAuthorityRule, MemoryPrincipal, MemoryStore } from "./types.js";

const principalMatches = (rule: MemoryAuthorityRule, principal: MemoryPrincipal): boolean =>
  rule.principalId === principal.id || principal.roles?.includes(rule.principalId) === true;

const authorityMatches = (rules: readonly MemoryAuthorityRule[], store: MemoryStore, principal: MemoryPrincipal): boolean => rules.some((rule) => {
  if (!principalMatches(rule, principal)) return false;
  if (rule.storeIds !== undefined && !rule.storeIds.includes(store.id)) return false;
  return rule.scopes === undefined || rule.scopes.some((scope) => normalizeScope(scope) === normalizeScope(store.scope));
});

export const canReadMemoryStore = (store: MemoryStore, principal: MemoryPrincipal | undefined): boolean => {
  if (!store.enabled) return false;
  if (store.publicRead) return true;
  return principal !== undefined && authorityMatches(store.readers, store, principal);
};

export const canWriteMemoryStore = (store: MemoryStore, principal: MemoryPrincipal | undefined): boolean => {
  if (!store.enabled) return false;
  if (store.publicWrite) return true;
  return principal !== undefined && authorityMatches(store.writers, store, principal);
};

