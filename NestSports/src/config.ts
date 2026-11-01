import { Platform } from "react-native";
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:5002/api`
  : 'https://sports-backend.pixelatenest.com/api';
