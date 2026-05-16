import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

const PREFS_INSTALL_DATE = 'scrollguard_install_date';
const PREFS_MONITORED_APPS = 'scrollguard_monitored_apps';

type InitialRoute = keyof RootStackParamList;

export default function App() {
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    (async () => {
      const [installDate, monitoredApps] = await AsyncStorage.multiGet([
        PREFS_INSTALL_DATE,
        PREFS_MONITORED_APPS,
      ]);

      const hasInstallDate = installDate[1] !== null;
      const hasApps = monitoredApps[1] !== null && JSON.parse(monitoredApps[1] ?? '[]').length > 0;

      if (hasInstallDate && hasApps) {
        setInitialRoute('Dashboard');
      } else {
        setInitialRoute('Welcome');
      }
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator initialRoute={initialRoute} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
