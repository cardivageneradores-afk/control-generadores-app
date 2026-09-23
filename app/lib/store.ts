import { DEMO_STATE } from './demo-data';
import type { AppState, User } from './types';

let store: AppState = structuredClone(DEMO_STATE);

export function getStore(): AppState {
  return structuredClone(store);
}

export function setStore(next: AppState): AppState {
  store = structuredClone(next);
  return getStore();
}

export function getCurrentUser(): User | null {
  return store.me ? { ...store.me } : null;
}

export function setCurrentUser(user: User | null): void {
  store = {
    ...store,
    me: user ? { ...user } : null,
  };
}

export function resetStore(): void {
  store = structuredClone(DEMO_STATE);
}
