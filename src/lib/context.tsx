import { createContext, useContext } from 'react';
import type { Data, Profile, Submission } from './types';
export type AppContextValue = {
  data: Data;
  profile: Profile;
  demo: boolean;
  busy: boolean;
  notify: (message: string, error?: boolean) => void;
  run: (operation: () => Promise<void>) => Promise<void>;
  save: <K extends keyof Data>(key: K, item: Data[K][number], update?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  navigate: (page: string) => void;
  openResult: (s: Submission) => void;
  startEssay: (themeId: string) => void;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('Contexto indisponível.');
  return value;
}
