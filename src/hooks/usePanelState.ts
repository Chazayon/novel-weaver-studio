import { useState, useEffect, useCallback, useRef } from 'react';

interface PanelState {
  [key: string]: boolean;
}

const STORAGE_KEY_PREFIX = 'novel-studio-panel-states';

function getStorageKey(scopeKey?: string | null): string {
  return scopeKey ? `${STORAGE_KEY_PREFIX}:${scopeKey}` : STORAGE_KEY_PREFIX;
}

function loadPanelStates(scopeKey?: string | null): PanelState {
  try {
    const stored = localStorage.getItem(getStorageKey(scopeKey));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePanelStates(scopeKey: string | null | undefined, states: PanelState): void {
  try {
    localStorage.setItem(getStorageKey(scopeKey), JSON.stringify(states));
  } catch {
    // localStorage might be unavailable
  }
}

export function usePanelState(
  panelId: string,
  defaultOpen: boolean = true,
  scopeKey?: string | null,
): [boolean, () => void] {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const stored = loadPanelStates(scopeKey);
    return stored[panelId] !== undefined ? stored[panelId] : defaultOpen;
  });

  const lastScopeKeyRef = useRef<string | null | undefined>(scopeKey);

  useEffect(() => {
    if (lastScopeKeyRef.current !== scopeKey) {
      lastScopeKeyRef.current = scopeKey;
      const stored = loadPanelStates(scopeKey);
      setIsOpen(stored[panelId] !== undefined ? stored[panelId] : defaultOpen);
      return;
    }

    const states = loadPanelStates(scopeKey);
    states[panelId] = isOpen;
    savePanelStates(scopeKey, states);
  }, [panelId, isOpen, scopeKey, defaultOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return [isOpen, toggle];
}
