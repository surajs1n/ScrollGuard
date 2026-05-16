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
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, CuratedApp } from '../../modules/UsageStats';
import { MonitorService } from '../../modules/MonitorService';
import {
  INTENSITY_PRESETS,
  DEFAULT_INTENSITY,
  IntensityLevel,
} from '../../config/intensityPresets';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MonitoredApps'>;

const INTENSITY_LEVELS: IntensityLevel[] = ['gentle', 'balanced', 'strict'];
const INTENSITY_ACCENT: Record<IntensityLevel, string> = {
  gentle: '#22c55e',
  balanced: '#6366f1',
  strict: '#ef4444',
};

export default function MonitoredAppsScreen({ navigation }: Props) {
  const [apps, setApps] = useState<CuratedApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState<IntensityLevel>(DEFAULT_INTENSITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [curatedApps, monitored, savedIntensity] = await Promise.all([
        UsageStats.getCuratedAppsWithStatus().catch(() => [] as CuratedApp[]),
        MonitorService.getMonitoredApps(),
        MonitorService.getIntensity(),
      ]);
      setApps(curatedApps);
      setSelected(new Set(monitored));
      setIntensity(savedIntensity);
      setLoading(false);
    }
    load();
  }, []);

  const toggle = (pkg: string, installed: boolean) => {
    if (!installed) {
      Alert.alert(
        'App not installed',
        "This app isn't on your device yet. Install it first, then come back to enable tracking.",
      );
      return;
    }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        MonitorService.updateMonitoredApps(Array.from(selected)),
        MonitorService.setIntensity(intensity),
      ]);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Monitored Apps</Text>
        <Text style={styles.subtitle}>
          Pick up to 5 apps. ScrollGuard tracks and nudges you on these.
          Greyed out apps aren't installed on this device yet.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Improvement pace</Text>
        <View style={styles.intensityRow}>
          {INTENSITY_LEVELS.map((level) => {
            const accent = INTENSITY_ACCENT[level];
            const isActive = intensity === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.intensityBtn, isActive && { borderColor: accent, backgroundColor: accent + '22' }]}
                onPress={() => setIntensity(level)}
                activeOpacity={0.75}
              >
                <Text style={[styles.intensityBtnText, isActive && { color: accent }]}>
                  {INTENSITY_PRESETS[level].label}
                </Text>
                <Text style={styles.intensityTagline}>
                  {INTENSITY_PRESETS[level].tagline}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle2}>Apps</Text>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Loading…</Text>
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
                style={[
                  styles.appRow,
                  isSelected && styles.appRowSelected,
                  !item.installed && styles.appRowDimmed,
                ]}
                onPress={() => toggle(item.packageName, item.installed)}
                activeOpacity={item.installed ? 0.75 : 0.4}
              >
                <View style={styles.appInfo}>
                  <View style={styles.nameLine}>
                    <Text style={[styles.appName, !item.installed && styles.appNameDimmed]}>
                      {item.appName}
                    </Text>
                    {!item.installed && (
                      <View style={styles.notInstalledBadge}>
                        <Text style={styles.notInstalledText}>not installed</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.appPkg}>{item.packageName}</Text>
                </View>
                <View style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected,
                  !item.installed && styles.checkboxDimmed,
                ]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selected.size} of 5 selected</Text>
        {selected.size === 0 && (
          <View style={styles.nudgeBanner}>
            <Text style={styles.nudgeText}>
              ⚠ No apps selected — ScrollGuard won't track or nudge anything.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { marginBottom: spacing.md },
  backText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sectionTitle: {
    fontSize: font.sm, fontWeight: '700', color: colors.textSecondary,
    marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionTitle2: {
    fontSize: font.sm, fontWeight: '700', color: colors.textSecondary,
    marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
  },
  intensityRow: { flexDirection: 'row', gap: spacing.sm },
  intensityBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 10, padding: spacing.sm, alignItems: 'center',
  },
  intensityBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.textSecondary },
  intensityTagline: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md, marginHorizontal: spacing.lg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loaderText: { color: colors.textSecondary, fontSize: font.md },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  appRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  appRowSelected: { borderColor: colors.accent },
  appRowDimmed: { opacity: 0.45 },
  appInfo: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  appName: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  appNameDimmed: { color: colors.textSecondary },
  notInstalledBadge: { backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  notInstalledText: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  appPkg: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxDimmed: { borderColor: colors.border },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  selectionCount: { color: colors.textSecondary, fontSize: font.sm, textAlign: 'center' },
  nudgeBanner: {
    backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  nudgeText: { color: colors.warning, fontSize: font.sm, lineHeight: 20 },
  saveBtn: { backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
});
