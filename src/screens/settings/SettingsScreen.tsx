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
import { exportData } from '../../modules/ExportService';
import { MonitorService } from '../../modules/MonitorService';
import { INTENSITY_PRESETS, IntensityLevel } from '../../config/intensityPresets';
import { useTheme, spacing, font, AppColors } from '../../ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface SettingsRow {
  key: string;
  icon: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  loading?: boolean;
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg },
    backBtn: { marginBottom: spacing.md },
    backText: { color: c.accent, fontSize: font.md, fontWeight: '600' },
    title: { fontSize: font.xxl, fontWeight: '700', color: c.textPrimary },
    list: {
      marginHorizontal: spacing.lg,
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    rowIcon: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
    },
    rowIconText: { fontSize: 20 },
    rowBody: { flex: 1 },
    rowLabel: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
    rowSublabel: { fontSize: font.xs, color: c.textSecondary, marginTop: 2, lineHeight: 16 },
    chevron: { fontSize: 22, color: c.textSecondary, fontWeight: '300' },
  });
}

export default function SettingsScreen({ navigation }: Props) {
  const { colors, refreshTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [exporting, setExporting] = useState(false);
  const [intensity, setIntensity] = useState<IntensityLevel | null>(null);

  useEffect(() => {
    MonitorService.getIntensity().then(setIntensity);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      MonitorService.getIntensity().then(setIntensity);
      refreshTheme();
    });
    return unsubscribe;
  }, [navigation, refreshTheme]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportData();
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  const intensityPreset = intensity ? INTENSITY_PRESETS[intensity] : null;

  const rows: SettingsRow[] = [
    {
      key: 'monitored_apps',
      icon: '📱',
      label: 'Monitored Apps',
      sublabel: 'Choose which apps ScrollGuard tracks',
      onPress: () => navigation.navigate('MonitoredApps'),
    },
    {
      key: 'intensity',
      icon: '🎯',
      label: 'Improvement Pace',
      sublabel: intensityPreset ? `${intensityPreset.label} — ${intensityPreset.tagline}` : 'Loading…',
      onPress: () => navigation.navigate('IntensitySettings'),
    },
    {
      key: 'export',
      icon: '↑',
      label: 'Export my data',
      sublabel: 'Share your usage history as a JSON file',
      onPress: handleExport,
      loading: exporting,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={row.key}
            style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
            onPress={row.onPress}
            disabled={row.loading}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              {row.loading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.rowIconText}>{row.icon}</Text>
              )}
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowSublabel}>{row.sublabel}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}
