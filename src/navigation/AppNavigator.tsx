import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import PermissionUsageStatsScreen from '../screens/onboarding/PermissionUsageStatsScreen';
import PermissionOverlayScreen from '../screens/onboarding/PermissionOverlayScreen';
import AppSelectionScreen from '../screens/onboarding/AppSelectionScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';

export type RootStackParamList = {
  Welcome: undefined;
  PermissionUsageStats: undefined;
  PermissionOverlay: undefined;
  AppSelection: undefined;
  Dashboard: { openSuggestion?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  initialRoute: keyof RootStackParamList;
}

export default function AppNavigator({ initialRoute }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PermissionUsageStats" component={PermissionUsageStatsScreen} />
      <Stack.Screen name="PermissionOverlay" component={PermissionOverlayScreen} />
      <Stack.Screen name="AppSelection" component={AppSelectionScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  );
}
