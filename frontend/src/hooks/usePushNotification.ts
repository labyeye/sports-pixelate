import { useEffect, useRef } from "react";
import { getToken } from "@/services/api";

const BASE_URL = import.meta.env.VITE_API_URL;

async function apiPost(endpoint: string, body: object): Promise<void> {
  const token = getToken();
  await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function registerPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await apiPost("/push/subscribe", {
      subscription: existing.toJSON(),
      userAgent: navigator.userAgent,
    });
    return;
  }

  const { publicKey } = await apiGet<{ publicKey: string }>(
    "/push/vapid-public-key",
  );
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await apiPost("/push/subscribe", {
    subscription: subscription.toJSON(),
    userAgent: navigator.userAgent,
  });
}

export function usePushNotification(enabled: boolean): void {
  const registered = useRef(false);

  useEffect(() => {
    if (!enabled || registered.current) return;
    registered.current = true;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => registerPush())
      .catch(() => {});
  }, [enabled]);
}
