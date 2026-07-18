/**
 * NestSports mobile app
 * @format
 */

import React from 'react';
import { StatusBar, Text, TextInput, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { FONT } from './src/theme/colors';
import { ToastProvider } from './src/components/ui';

// Applies DM Sans as the default typeface everywhere without touching every
// screen's local styles — individual styles still override fontFamily for
// bold/medium weights (see components/ui.tsx), same look as NestHR.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = [{ fontFamily: FONT.regular }, (Text as any).defaultProps.style];
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.style = [{ fontFamily: FONT.regular }, (TextInput as any).defaultProps.style];

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
