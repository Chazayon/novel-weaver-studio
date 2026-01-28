import { useState, useEffect, useCallback } from 'react';

interface PanelState {
  [key: string]: boolean;
}

const STORAGE_KEY = 'novel-studio-panel-states';

function loadPanelStates(): PanelState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePanelStates(states: PanelState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // localStorage might be unavailable
  }
}

export function usePanelState(panelId: string, defaultOpen: boolean = true): [boolean, () => void] {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const stored = loadPanelStates();
    return stored[panelId] !== undefined ? stored[panelId] : defaultOpen;
  });

  useEffect(() => {
    const states = loadPanelStates();
    states[panelId] = isOpen;
    savePanelStates(states);
  }, [panelId, isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return [isOpen, toggle];
}
