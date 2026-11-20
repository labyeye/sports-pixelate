/**
 * Push notifications (Firebase Cloud Messaging).
 *
 * Native setup: android/app/google-services.json, ios/NestPlay/GoogleService-Info.plist and
 * FirebaseApp.configure() in AppDelegate.swift. The Firebase module is loaded lazily so a binary built
 * before it was added keeps working (push is simply off).
 */
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { getToken as getAuthToken } from '../api/client';
import { API_BASE_URL } from '../config';

export type PushData = { type?: string; screen?: string; id?: string } | undefined;

function fcm(): any | null {
  try {
    return require('@react-native-firebase/messaging');
  } catch {
    return null;
  }
}

let currentToken: string | null = null;

async function registerFCMToken(fcmToken: string) {
  const authToken = await getAuthToken();
  if (!authToken) return;
  currentToken = fcmToken;
  await fetch(`${API_BASE_URL}/push/fcm-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fcmToken, platform: Platform.OS }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const m = fcm();
  if (!m) return false;
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await m.requestPermission(m.getMessaging());
  return (
    status === m.AuthorizationStatus.AUTHORIZED ||
    status === m.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Asks for permission, registers this device with the backend and listens for pushes.
 * onOpen fires when the user taps a notification (or "View" on the in-app alert).
 * Returns a cleanup function. Never throws: without Firebase (old binary, simulator) it is a no-op.
 */
export async function setupPushNotifications(
  onOpen?: (data: PushData) => void,
): Promise<() => void> {
  const m = fcm();
  if (!m) return () => {};
  try {
    const messaging = m.getMessaging();
    if (!(await requestNotificationPermission())) return () => {};

    const token = await m.getToken(messaging);
    if (token) await registerFCMToken(token);

    const unsubs: (() => void)[] = [
      m.onTokenRefresh(messaging, (t: string) => {
        registerFCMToken(t).catch(() => {});
      }),
      // App open: the system shows no banner, so show the message ourselves.
      m.onMessage(messaging, async (msg: any) => {
        const n = msg?.notification;
        if (!n) return;
        Alert.alert(n.title || 'Notification', n.body || '', [
          { text: 'Dismiss', style: 'cancel' },
          ...(onOpen
            ? [{ text: 'View', onPress: () => onOpen(msg.data) }]
            : []),
        ]);
      }),
      // App in background: user tapped the notification.
      m.onNotificationOpenedApp(messaging, (msg: any) => onOpen?.(msg?.data)),
    ];

    // App was closed and got opened by tapping a notification.
    const initial = await m.getInitialNotification(messaging);
    if (initial) onOpen?.(initial.data);

    return () => unsubs.forEach(u => u());
  } catch (e: any) {
    console.log('[Push] setup skipped:', e?.message);
    return () => {};
  }
}

/** Call before signing out so this phone stops receiving the previous user's notifications. */
export async function unregisterPush() {
  try {
    const authToken = await getAuthToken();
    if (!authToken || !currentToken) return;
    await fetch(`${API_BASE_URL}/push/unsubscribe`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcmToken: currentToken }),
    });
    currentToken = null;
  } catch {}
}
