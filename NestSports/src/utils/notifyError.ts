import { Alert } from 'react-native';
import { getErrorMessage } from './format';

let lastMessage = '';
let lastShownAt = 0;

/**
 * Shows a plain-language error popup for a caught failure. Identical messages
 * within 3 seconds are shown once, so several requests failing together (e.g.
 * offline) don't stack up alerts. Usable directly as `.catch(notifyError)`.
 */
export function notifyError(e: unknown, title = 'Something went wrong') {
  const message = getErrorMessage(e);
  const now = Date.now();
  if (message === lastMessage && now - lastShownAt < 3000) return;
  lastMessage = message;
  lastShownAt = now;
  Alert.alert(title, message);
}
