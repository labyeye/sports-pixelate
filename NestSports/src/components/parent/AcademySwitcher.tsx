import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react-native';
import { authAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { notifyError } from '../../utils/notifyError';
import { PickerField } from '../ui';

interface Account {
  userId: string;
  academy: { id: string; name: string };
}

// Shown only to parents signed in by phone OTP whose number is enrolled in
// more than one academy. Switching swaps the session to that academy's
// account; RootNavigator remounts on the user id so every screen refetches.
export function AcademySwitcher() {
  const { user, completeLogin } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentId, setCurrentId] = useState('');

  useEffect(() => {
    let cancelled = false;
    authAPI
      .listAcademies()
      .then(res => {
        if (cancelled) return;
        setAccounts(res.data.accounts || []);
        setCurrentId(String(res.data.currentUserId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (accounts.length < 2) return null;

  const nameOf = (a: Account) =>
    accounts.filter(o => o.academy.name === a.academy.name).length > 1
      ? `${a.academy.name} (${a.userId.slice(-4)})`
      : a.academy.name;
  const byName = new Map(accounts.map(a => [nameOf(a), a.userId]));
  const current = accounts.find(a => a.userId === currentId);

  const onChange = async (label: string) => {
    const userId = byName.get(label);
    if (!userId || userId === currentId) return;
    try {
      const res = await authAPI.switchAcademy(userId);
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <PickerField
      label="Academy"
      icon={Building2}
      value={current ? nameOf(current) : ''}
      options={[...byName.keys()]}
      onChange={onChange}
    />
  );
}
