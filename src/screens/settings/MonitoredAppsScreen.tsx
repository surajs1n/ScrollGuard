import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  SectionList,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, CuratedApp, InstalledApp } from '../../modules/UsageStats';
import { MonitorService } from '../../modules/MonitorService';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MonitoredApps'>;

type AppItem = { packageName: string; appName: string; installed: boolean };
type Section = { title: string; data: AppItem[] };

export default function MonitoredAppsScreen({ navigation }: Props) {
  const [curatedApps, setCuratedApps] = useState<CuratedApp[]>([]);
  const [userApps, setUserApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [curated, user, monitored] = await Promise.all([
        UsageStats.getCuratedAppsWithStatus().catch(() => [] as CuratedApp[]),
        UsageStats.getInstalledUserApps().catch(() => [] as InstalledApp[]),
        MonitorService.getMonitoredApps(),
      ]);
      const installed = curated.filter((a) => a.installed).sort((a, b) => a.appName.localeCompare(b.appName));
      const notInstalled = curated.filter((a) => !a.installed).sort((a, b) => a.appName.localeCompare(b.appName));
      setCuratedApps([...installed, ...notInstalled]);
      setUserApps(user);
      setSelected(new Set(monitored));
      setLoading(false);
    }
    load();
  }, []);

  const sections: Section[] = useMemo(() => {
    const q = search.toLowerCase();
    const filteredCurated: AppItem[] = curatedApps
      .filter((a) => !q || a.appName.toLowerCase().includes(q))
      .map((a) => ({ packageName: a.packageName, appName: a.appName, installed: a.installed }));
    const filteredUser: AppItem[] = userApps
      .filter((a) => !q || a.appName.toLowerCase().includes(q))
      .map((a) => ({ packageName: a.packageName, appName: a.appName, installed: true }));
    return [
      { title: 'Popular apps', data: filteredCurated },
      { title: 'Other apps on your device', data: filteredUser },
    ].filter((s) => s.data.length > 0);
  }, [curatedApps, userApps, search]);

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
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await MonitorService.updateMonitoredApps(Array.from(selected));
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AppItem }) => {
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
          ScrollGuard tracks and nudges you on these apps.
          Greyed out apps aren't installed on this device yet.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.packageName}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.emptyMsg}>No apps match "{search}"</Text>
            }
          />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selected.size} selected</Text>
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
    paddingBottom: spacing.sm,
  },
  backBtn: { marginBottom: spacing.md },
  backText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },

  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loaderText: { color: colors.textSecondary, fontSize: font.md },

  listContainer: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  list: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },

  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
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
  emptyMsg: { color: colors.textSecondary, fontSize: font.sm, padding: spacing.md, textAlign: 'center' },

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
