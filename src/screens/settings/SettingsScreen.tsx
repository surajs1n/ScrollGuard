import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { exportData } from '../../modules/ExportService';
import { MonitorService } from '../../modules/MonitorService';
import { UsageStats } from '../../modules/UsageStats';
import { INTENSITY_PRESETS, IntensityLevel } from '../../config/intensityPresets';
import { seedTestData, clearAllUsageData } from '../../storage/db';
import { useTheme } from '../../ThemeContext';
import { SG, SgFonts, ACCENT } from '../../theme';
import { SgScreen, SgMark } from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function SettingRow({
  icon,
  iconBg,
  label,
  sub,
  valueBadge,
  onPress,
  loading,
  labelColor,
}: {
  icon: string;
  iconBg: string;
  label: string;
  sub: string;
  valueBadge?: string;
  onPress: () => void;
  loading?: boolean;
  labelColor?: string;
}) {
  return (
    <TouchableOpacity
      style={rowStyles.row}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <View style={[rowStyles.iconBox, { backgroundColor: iconBg }]}>
        {loading ? (
          <ActivityIndicator color={SG.fg2} size="small" />
        ) : (
          <Text style={rowStyles.iconText}>{icon}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, labelColor ? { color: labelColor } : {}]}>{label}</Text>
        <Text style={rowStyles.sub}>{sub}</Text>
      </View>
      <View style={rowStyles.right}>
        {valueBadge ? (
          <Text style={rowStyles.badge}>{valueBadge}</Text>
        ) : null}
        <Text style={rowStyles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: SG.rSm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 17 },
  label: {
    fontFamily: SgFonts.uiMedium,
    fontSize: 14.5,
    color: SG.fg,
    marginBottom: 1,
  },
  sub: {
    fontFamily: SgFonts.ui,
    fontSize: 12,
    color: SG.fg3,
    lineHeight: 17,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  badge: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg3,
    letterSpacing: 0.5,
    backgroundColor: SG.surface2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chevron: { fontSize: 20, color: SG.fg4, fontWeight: '300' },
});

function SgCardSection({
  eyebrow,
  children,
  borderColor,
}: {
  eyebrow: string;
  children: React.ReactNode;
  borderColor?: string;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.eyebrow}>{eyebrow}</Text>
      <View
        style={[
          sectionStyles.card,
          borderColor ? { borderColor } : {},
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  eyebrow: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg3,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
    overflow: 'hidden',
  },
});

function Divider() {
  return <View style={{ height: 1, backgroundColor: SG.lineSoft, marginLeft: 64 }} />;
}

export default function SettingsScreen({ navigation }: Props) {
  const { refreshTheme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
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

  const handleSeed = () => {
    if (!intensity) return;
    const preset = INTENSITY_PRESETS[intensity];
    Alert.alert(
      'Seed test data?',
      `This will insert ${preset.sampleDays} days of synthetic usage data based on your ${preset.label} profile. Existing data for those dates will be overwritten.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            setSeeding(true);
            try {
              const [monitoredPkgs, installedApps] = await Promise.all([
                MonitorService.getMonitoredApps(),
                UsageStats.getInstalledMonitoredApps().catch(() => []),
              ]);
              const nameMap = new Map(installedApps.map((a) => [a.packageName, a.appName]));
              const apps = monitoredPkgs.map((pkg) => ({
                packageName: pkg,
                appName: nameMap.get(pkg) ?? pkg,
              }));
              await seedTestData(apps, preset);
              Alert.alert('Done', `${preset.sampleDays} days of test data seeded. Pull to refresh the dashboard.`);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Something went wrong.');
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear all usage data?',
      'This deletes all usage history from the app. The dashboard will be empty until new data is collected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearAllUsageData();
              Alert.alert('Cleared', 'All usage data has been deleted.');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Something went wrong.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const intensityPreset = intensity ? INTENSITY_PRESETS[intensity] : null;

  return (
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>Settings</Text>

        {/* HOW IT WATCHES */}
        <SgCardSection eyebrow="HOW IT WATCHES">
          <SettingRow
            icon="📱"
            iconBg={SG.surface2}
            label="Monitored apps"
            sub="Choose which apps ScrollGuard tracks"
            onPress={() => navigation.navigate('MonitoredApps')}
          />
          <Divider />
          <SettingRow
            icon="🎯"
            iconBg={SG.surface2}
            label="Improvement pace"
            sub={intensityPreset ? intensityPreset.tagline : 'Loading…'}
            valueBadge={intensity ? intensity.toUpperCase() : undefined}
            onPress={() => navigation.navigate('IntensitySettings')}
          />
          <Divider />
          <SettingRow
            icon="💬"
            iconBg={SG.surface2}
            label="In-app nudges"
            sub="Draw-over permission for gentle overlay cards"
            onPress={() => {}}
          />
        </SgCardSection>

        {/* YOUR DATA */}
        <SgCardSection eyebrow="YOUR DATA">
          <SettingRow
            icon="↑"
            iconBg={SG.surface2}
            label="Export my data"
            sub="Share your usage history as a JSON file"
            onPress={handleExport}
            loading={exporting}
          />
          <Divider />
          <SettingRow
            icon="🔒"
            iconBg={SG.surface2}
            label="Privacy"
            sub="All data stays on your device. Nothing is sent anywhere."
            onPress={() => {}}
          />
        </SgCardSection>

        {/* DEVELOPER & TESTING */}
        <SgCardSection eyebrow="DEVELOPER & TESTING" borderColor={`${SG.amber}55`}>
          <SettingRow
            icon="🧪"
            iconBg={`${SG.amber}18`}
            label={`Seed ${intensityPreset?.sampleDays ?? '…'} days of test data`}
            sub={`Generates synthetic usage based on the ${intensityPreset?.label ?? '…'} profile`}
            onPress={handleSeed}
            loading={seeding}
            labelColor={SG.amber}
          />
          <Divider />
          <SettingRow
            icon="🗑"
            iconBg={`${SG.strict}18`}
            label="Clear all usage data"
            sub="Wipes usage_snapshots — dashboard goes empty"
            onPress={handleClearData}
            loading={clearing}
            labelColor={SG.strict}
          />
        </SgCardSection>

        {/* Footer */}
        <View style={styles.footer}>
          <SgMark size={18} accent={intensity ? ACCENT[intensity].accent : SG.balanced} outline={SG.fg} />
          <Text style={styles.footerText}>SCROLLGUARD · v1.0.0 · ON-DEVICE</Text>
        </View>
      </ScrollView>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  headline: {
    fontFamily: SgFonts.display,
    fontSize: 42,
    color: SG.fg,
    letterSpacing: -0.8,
    lineHeight: 48,
    marginBottom: 28,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  footerText: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg4,
    letterSpacing: 0.8,
  },
});
