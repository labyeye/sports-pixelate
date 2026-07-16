import { Platform } from 'react-native';

// The backend (backend/server.js) listens on 5002. Android emulators can't
// reach the host machine via "localhost" — they need the special alias
// 10.0.2.2 — so we swap it in for Android only. iOS simulator and physical
// devices on the same LAN should override this via API_BASE_URL below.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL = `http://${DEV_HOST}:5002/api`;
