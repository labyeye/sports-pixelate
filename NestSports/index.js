/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Android needs a background handler registered before the app component; the system tray shows the notification.
try {
  const m = require('@react-native-firebase/messaging');
  m.setBackgroundMessageHandler(m.getMessaging(), async () => {});
} catch {}

AppRegistry.registerComponent(appName, () => App);
