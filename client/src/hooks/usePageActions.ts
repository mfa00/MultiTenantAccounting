import { useState, useEffect } from 'react';

// Global state for triggering page actions
let globalTriggers: Record<string, () => void> = {};

export function usePageActions() {
  const [triggers, setTriggers] = useState<Record<string, () => void>>({});

  useEffect(() => {
    // Update global triggers when local triggers change
    globalTriggers = { ...globalTriggers, ...triggers };
  }, [triggers]);

  const registerTrigger = (actionType: string, callback: () => void) => {
    setTriggers(prev => ({
      ...prev,
      [actionType]: callback
    }));
  };

  const triggerAction = (actionType: string) => {
    if (globalTriggers[actionType]) {
      globalTriggers[actionType]();
      return true;
    }
    return false;
  };

  return {
    registerTrigger,
    triggerAction,
  };
}

// Global function to trigger actions from anywhere
export function triggerPageAction(actionType: string): boolean {
  if (globalTriggers[actionType]) {
    globalTriggers[actionType]();
    return true;
  }
  return false;
} 