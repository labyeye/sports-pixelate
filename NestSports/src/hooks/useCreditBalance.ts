import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { creditsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export interface CreditBalance {
  metered: boolean;
  balance?: number;
  bonus?: number;
  bonusExpiresAt?: string | null;
  total?: number;
  low?: boolean;
  zero?: boolean;
  dailyCap?: number;
  ratePerMessage?: number;
}

/** 3203 -> "3,203", 0.4 -> "0.4" */
export const fmtCredits = (n = 0) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** WhatsApp wallet for admins/HR. Refetches whenever the screen comes back into focus (e.g. after topping up on the web). */
export function useCreditBalance() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const allowed = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const refresh = useCallback(async () => {
    if (!allowed) return setCredits(null);
    try {
      const res: any = await creditsAPI.balance();
      if (res?.success) setCredits(res.data);
    } catch {
      // header simply shows no pill
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { credits, refresh };
}
