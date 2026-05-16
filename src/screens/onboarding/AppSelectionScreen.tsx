import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  NativeModules,
  Intent,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, InstalledApp } from '../../modules/UsageStats';
import { MonitorService } from '../../modules/MonitorService';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSelection'>;

export default function AppSelectionScreen({ navigation }: Props) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    UsageStats.getInstalledMonitoredApps()
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else if (next.size < 5) {
        next.add(pkg);
      } else {
        Alert.alert('Maximum 5 apps', 'Pick up to 5 apps to keep it manageable.');
      }
      return next;
    });
  };

  const handleDone = async () => {
    if (selected.size < 1) {
      Alert.alert('Pick at least one app', 'You need to monitor at least one app.');
      return;
    }
    setSaving(true);
    try {
      await MonitorService.init(Array.from(selected));

      // Start the background monitoring service
      if (Platform.OS === 'android') {
        const { UsageStats: NativeUsage } = NativeModules;
        // Signal the native service to start (via an intent)
        // The service is also started from BootReceiver after reboot
        await startMonitorService();
      }

      navigation.reset({ index: 0, routes: [{ name: 'Dashboard', params: {} }] });
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 3 of 3</Text>
        <Text style={styles.title}>Which apps do you want to watch?</Text>
        <Text style={styles.subtitle}>
          Pick 2–5. These are the ones ScrollGuard will track and nudge you on.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Scanning installed apps…</Text>
        </View>
      ) : apps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            None of the commonly monitored apps (Instagram, YouTube, Reddit, etc.)
            are installed. You can add them later in Settings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={(item) => item.packageName}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.packageName);
            return (
              <TouchableOpacity
                style={[styles.appRow, isSelected && styles.appRowSelected]}
                onPress={() => toggle(item.packageName)}
                activeOpacity={0.75}
              >
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{item.appName}</Text>
                  <Text style={styles.appPkg}>{item.packageName}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>
          {selected.size} of 5 selected
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, selected.size === 0 && styles.primaryBtnDisabled]}
          onPress={handleDone}
          disabled={saving || selected.size === 0}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Start watching →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

async function startMonitorService(): Promise<void> {
  // Dynamically send an intent to start the foreground service
  // This is done via a simple RN bridge call
  try {
    const { UsageStats } = NativeModules;
    if (UsageStats?.startMonitorService) {
      await UsageStats.startMonitorService();
    }
  } catch {
    // Non-fatal: service also starts on next boot
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loaderText: { color: colors.textSecondary, fontSize: font.md },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.md,
    lineHeight: 24,
    textAlign: 'center',
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  appRowSelected: { borderColor: colors.accent },
  appInfo: { flex: 1 },
  appName: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  appPkg: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  selectionCount: {
    color: colors.textSecondary,
    fontSize: font.sm,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
});
