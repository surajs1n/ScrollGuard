import React, { useEffect, useMemo, useState } from 'react';
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
import { INTENSITY_PRESETS, INTENSITY_COLORS, DEFAULT_INTENSITY, IntensityLevel } from '../../config/intensityPresets';
import { useTheme, spacing, font, AppColors } from '../../ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'IntensitySettings'>;

const LEVELS: IntensityLevel[] = ['gentle', 'balanced', 'strict'];

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    backBtn: { marginBottom: spacing.md },
    backText: { color: c.accent, fontSize: font.md, fontWeight: '600' },
    title: { fontSize: font.xl, fontWeight: '700', color: c.textPrimary, marginBottom: spacing.sm },
    subtitle: { fontSize: font.sm, color: c.textSecondary, lineHeight: 20 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    cards: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md },
    card: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: spacing.md,
      backgroundColor: c.surface,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm },
    cardLabel: { fontSize: font.lg, fontWeight: '700', color: c.textPrimary },
    cardTagline: { fontSize: font.sm, color: c.textSecondary },
    cardDesc: { fontSize: font.sm, color: c.textSecondary, lineHeight: 20, marginBottom: spacing.md },
    statsRow: { flexDirection: 'row', gap: spacing.md },
    stat: { alignItems: 'center' },
    statValue: { fontSize: font.md, fontWeight: '700', color: c.textPrimary },
    statLabel: { fontSize: font.xs, color: c.textSecondary, marginTop: 2 },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    saveBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  });
}

export default function IntensitySettingsScreen({ navigation }: Props) {
  const { colors, refreshTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      refreshTheme();
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
            const accent = INTENSITY_COLORS[level].accent;
            const isActive = intensity === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.card, isActive && { borderColor: accent, backgroundColor: accent + '18' }]}
                onPress={() => setIntensity(level)}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, isActive && { color: accent }]}>{preset.label}</Text>
                  <Text style={[styles.cardTagline, isActive && { color: accent }]}>{preset.tagline}</Text>
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
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
