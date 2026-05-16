import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats } from '../../modules/UsageStats';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PermissionUsageStats'>;

export default function PermissionUsageStatsScreen({ navigation }: Props) {
  const [permGranted, setPermGranted] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkPerm = async () => {
    const granted = await UsageStats.hasPermission();
    setPermGranted(granted);
    setChecking(false);
  };

  useEffect(() => {
    checkPerm();

    // Re-check when user returns from Settings
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkPerm();
    });
    return () => sub.remove();
  }, []);

  const handleGrant = async () => {
    await UsageStats.openPermissionSettings();
  };

  const handleContinue = () => {
    navigation.navigate('PermissionOverlay');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title}>Screen time data</Text>
        <Text style={styles.description}>
          ScrollGuard needs to read how much time you spend in each app.
          {'\n\n'}
          This data never leaves your phone. It's stored only on your device and
          used exclusively to show you your own progress.
          {'\n\n'}
          Android requires you to enable this manually in Settings:
          {'\n'}
          Settings → Digital Wellbeing → Apps with Usage Access → ScrollGuard
        </Text>

        <View style={styles.permBox}>
          <Text style={styles.permIcon}>{permGranted ? '✅' : '⏳'}</Text>
          <Text style={styles.permStatus}>
            {checking
              ? 'Checking…'
              : permGranted
              ? 'Permission granted'
              : 'Permission not yet granted'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {!permGranted ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleGrant}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        )}

        {!permGranted && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleContinue}>
            <Text style={styles.skipText}>Skip for now (limited features)</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xxl,
  },
  step: {
    color: colors.accent,
    fontSize: font.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: font.md,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  permBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  permIcon: {
    fontSize: font.lg,
  },
  permStatus: {
    fontSize: font.md,
    color: colors.textPrimary,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: font.md,
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: font.sm,
  },
});
