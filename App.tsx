import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';

import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { SG } from './src/theme';

const PREFS_INSTALL_DATE = 'scrollguard_install_date';
const PREFS_MONITORED_APPS = 'scrollguard_monitored_apps';

type InitialRoute = keyof RootStackParamList;

function AppInner() {
  const { accent } = useTheme();
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    (async () => {
      const [installDate, monitoredApps] = await AsyncStorage.multiGet([
        PREFS_INSTALL_DATE,
        PREFS_MONITORED_APPS,
      ]);
      const hasInstallDate = installDate[1] !== null;
      const hasApps =
        monitoredApps[1] !== null &&
        JSON.parse(monitoredApps[1] ?? '[]').length > 0;
      setInitialRoute(hasInstallDate && hasApps ? 'Dashboard' : 'Welcome');
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: SG.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator initialRoute={initialRoute} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    'InstrumentSerif-Regular': require('./assets/fonts/InstrumentSerif-Regular.ttf'),
    'InstrumentSerif-Italic':  require('./assets/fonts/InstrumentSerif-Italic.ttf'),
    'Geist-Regular':           require('./assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium':            require('./assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold':          require('./assets/fonts/Geist-SemiBold.ttf'),
    'JetBrainsMono-Regular':   require('./assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium':    require('./assets/fonts/JetBrainsMono-Medium.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: SG.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={SG.balanced} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
