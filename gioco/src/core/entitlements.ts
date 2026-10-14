/**
 * Diritti d'uso (GDD 15). Sul web tutto è sempre sbloccato. Sugli store il
 * modulo si collegherà agli acquisti nativi (StoreKit, Google Play Billing)
 * registrando un fornitore con setEntitlementProvider: il resto del gioco
 * chiede solo isUnlocked('fullGame') e non cambia.
 * Finché nessun fornitore è registrato, anche in nativo la risposta è "sbloccato".
 */
import type { Entitlements } from './types';

export type EntitlementProvider = (feature: 'fullGame') => boolean;

export interface CoreEntitlements extends Entitlements {
  setProvider(p: EntitlementProvider | null): void;
}

export function createEntitlements(native: boolean): CoreEntitlements {
  let provider: EntitlementProvider | null = null;
  return {
    isUnlocked(feature) {
      if (!native) return true;
      return provider ? provider(feature) : true;
    },
    setProvider(p) {
      provider = p;
    },
  };
}
