import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  NativeModules,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  INTENSITY_PRESETS,
  DEFAULT_INTENSITY,
  IntensityLevel,
} from '../../config/intensityPresets';
import { MonitorService } from '../../modules/MonitorService';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'IntensitySelection'>;

const LEVELS: IntensityLevel[] = ['gentle', 'balanced', 'strict'];

const LEVEL_ACCENT: Record<IntensityLevel, string> = {
  gentle: '#22c55e',   // green
  balanced: '#6366f1', // indigo
  strict: '#ef4444',   // red
};

export default function IntensitySelectionScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<IntensityLevel>(DEFAULT_INTENSITY);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    setSaving(true);
    try {
      await MonitorService.setIntensity(selected);
      if (Platform.OS === 'android') {
        const { UsageStats } = NativeModules;
        if (UsageStats?.startMonitorService) {
          await UsageStats.startMonitorService();
        }
      }
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard', params: {} }] });
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.step}>Step 4 of 4</Text>
        <Text style={styles.title}>How fast do you want to improve?</Text>
        <Text style={styles.subtitle}>
          This controls how quickly ScrollGuard tightens your targets and how
          much friction it adds when you've gone over. You can change this anytime.
        </Text>

        <View style={styles.cards}>
          {LEVELS.map((level) => {
            const preset = INTENSITY_PRESETS[level];
            const accent = LEVEL_ACCENT[level];
            const isSelected = selected === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.card, isSelected && { borderColor: accent }]}
                onPress={() => setSelected(level)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardLabel}>{preset.label}</Text>
                    <Text style={styles.cardTagline}>{preset.tagline}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && { borderColor: accent }]}>
                    {isSelected && <View style={[styles.radioFill, { backgroundColor: accent }]} />}
                  </View>
                </View>

                <Text style={styles.cardDesc}>{preset.description}</Text>

                <View style={styles.stats}>
                  <Stat label="Learns in" value={`${preset.sampleDays} days`} />
                  <Stat label="Weekly cut" value={`${preset.weeklyReductionPct * 100}%`} />
                  <Stat label="Cooldown" value={`${preset.cooldownMinutes} min`} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStart}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Start ScrollGuard →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={statStyles.container}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  value: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  backBtn: { marginBottom: spacing.md },
  backText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  step: { color: colors.accent, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  title: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  cards: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  cardTitles: { flex: 1 },
  cardLabel: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  cardTagline: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  cardDesc: {
    fontSize: font.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
});
