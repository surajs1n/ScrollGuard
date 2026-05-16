import React, { useState } from 'react';
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
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface SettingsRow {
  key: string;
  icon: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  loading?: boolean;
}

export default function SettingsScreen({ navigation }: Props) {
  const [exporting, setExporting] = useState(false);

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

  const rows: SettingsRow[] = [
    {
      key: 'monitored_apps',
      icon: '📱',
      label: 'Monitored Apps',
      sublabel: 'Choose apps to track and set your improvement pace',
      onPress: () => navigation.navigate('MonitoredApps'),
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: { marginBottom: spacing.md },
  backText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.textPrimary },
  list: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowIconText: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  rowSublabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  chevron: { fontSize: 22, color: colors.textSecondary, fontWeight: '300' },
});
