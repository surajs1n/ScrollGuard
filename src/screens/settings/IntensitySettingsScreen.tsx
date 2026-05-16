import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { MonitorService } from '../../modules/MonitorService';
import { INTENSITY_PRESETS, DEFAULT_INTENSITY, IntensityLevel } from '../../config/intensityPresets';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'IntensitySettings'>;

const LEVELS: IntensityLevel[] = ['gentle', 'balanced', 'strict'];
const ACCENT: Record<IntensityLevel, string> = {
  gentle: '#22c55e',
  balanced: '#6366f1',
  strict: '#ef4444',
};

export default function IntensitySettingsScreen({ navigation }: Props) {
  const [intensity, setIntensity] = useState<IntensityLevel>(DEFAULT_INTENSITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    MonitorService.getIntensity().then((v) => {
      setIntensity(v);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await MonitorService.setIntensity(intensity);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
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
        <Text style={styles.title}>Improvement Pace</Text>
        <Text style={styles.subtitle}>
          Controls how fast ScrollGuard tightens your daily targets and how firmly it nudges you.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <View style={styles.cards}>
          {LEVELS.map((level) => {
            const preset = INTENSITY_PRESETS[level];
            const accent = ACCENT[level];
            const isActive = intensity === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.card, isActive && { borderColor: accent, backgroundColor: accent + '18' }]}
                onPress={() => setIntensity(level)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, isActive && { color: accent }]}>
                    {preset.label}
                  </Text>
                  <Text style={[styles.cardTagline, isActive && { color: accent }]}>
                    {preset.tagline}
                  </Text>
                </View>
                <Text style={styles.cardDesc}>{preset.description}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{preset.sampleDays}d</Text>
                    <Text style={styles.statLabel}>baseline</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{Math.round(preset.weeklyReductionPct * 100)}%</Text>
                    <Text style={styles.statLabel}>weekly cut</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{preset.cooldownMinutes}m</Text>
                    <Text style={styles.statLabel}>cooldown</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving || loading}
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cards: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md },
  card: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm },
  cardLabel: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  cardTagline: { fontSize: font.sm, color: colors.textSecondary },
  cardDesc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: { alignItems: 'center' },
  statValue: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
});
