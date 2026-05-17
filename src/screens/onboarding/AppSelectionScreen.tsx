import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  SectionList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, CuratedApp, InstalledApp } from '../../modules/UsageStats';
import { MonitorService } from '../../modules/MonitorService';
import { useTheme, spacing, font, AppColors } from '../../ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSelection'>;

type AppItem = { packageName: string; appName: string; installed: boolean };
type Section = { title: string; data: AppItem[] };

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    backBtn: { marginBottom: spacing.md },
    backText: { color: c.accent, fontSize: font.md, fontWeight: '600' },
    step: { color: c.accent, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
    title: { fontSize: font.xl, fontWeight: '700', color: c.textPrimary, marginBottom: spacing.sm },
    subtitle: { fontSize: font.sm, color: c.textSecondary, lineHeight: 20 },

    searchContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    searchInput: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: font.md,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loaderText: { color: c.textSecondary, fontSize: font.md },

    listContainer: {
      flex: 1,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: c.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      // no overflow:hidden — allows scrollbar indicator to render at the edge
    },
    list: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },

    sectionHeader: {
      fontSize: font.xs,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },

    appRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    appRowSelected: { borderColor: c.accent },
    appIconWrap: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: c.border, justifyContent: 'center', alignItems: 'center',
      marginRight: spacing.sm, overflow: 'hidden',
    },
    appIconImg: { width: 40, height: 40, borderRadius: 10 },
    appIconInitial: { fontSize: 18, fontWeight: '700', color: c.textSecondary },
    appInfo: { flex: 1 },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    appName: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
    appPkg: { fontSize: font.xs, color: c.textSecondary, marginTop: 2 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: { backgroundColor: c.accent, borderColor: c.accent },
    checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
    emptyMsg: { color: c.textSecondary, fontSize: font.sm, padding: spacing.md, textAlign: 'center' },

    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    selectionCount: { color: c.textSecondary, fontSize: font.sm, textAlign: 'center' },
    primaryBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
    nudgeBanner: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
    },
    nudgeText: { color: c.warning, fontSize: font.sm, lineHeight: 20 },
  });
}

type RowStyles = ReturnType<typeof makeStyles>;

function AppRow({
  item,
  isSelected,
  onToggle,
  styles,
}: {
  item: AppItem;
  isSelected: boolean;
  onToggle: (pkg: string) => void;
  styles: RowStyles;
}) {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    UsageStats.getAppIcon(item.packageName).then((b64) => {
      if (!cancelled && b64) setIcon(b64);
    });
    return () => { cancelled = true; };
  }, [item.packageName]);

  return (
    <TouchableOpacity
      style={[styles.appRow, isSelected && styles.appRowSelected]}
      onPress={() => onToggle(item.packageName)}
      activeOpacity={0.75}
    >
      <View style={styles.appIconWrap}>
        {icon ? (
          <Image source={{ uri: `data:image/png;base64,${icon}` }} style={styles.appIconImg} />
        ) : (
          <Text style={styles.appIconInitial}>{item.appName[0]?.toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{item.appName}</Text>
      </View>
      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Text style={styles.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function AppSelectionScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [curatedApps, setCuratedApps] = useState<CuratedApp[]>([]);
  const [userApps, setUserApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      UsageStats.getCuratedAppsWithStatus().catch(() => [] as CuratedApp[]),
      UsageStats.getInstalledUserApps().catch(() => [] as InstalledApp[]),
    ]).then(([curated, user]) => {
      const installedCurated = curated
        .filter((a) => a.installed)
        .sort((a, b) => a.appName.localeCompare(b.appName));
      setCuratedApps(installedCurated);
      setUserApps(user);
      setLoading(false);
    });
  }, []);

  const sections: Section[] = useMemo(() => {
    const q = search.toLowerCase();
    const matches = (name: string, pkg: string) =>
      !q || name.toLowerCase().includes(q) || pkg.toLowerCase().includes(q);
    const filteredCurated: AppItem[] = curatedApps
      .filter((a) => matches(a.appName, a.packageName))
      .map((a) => ({ packageName: a.packageName, appName: a.appName, installed: true }));
    const filteredUser: AppItem[] = userApps
      .filter((a) => matches(a.appName, a.packageName))
      .map((a) => ({ packageName: a.packageName, appName: a.appName, installed: true }));
    return [
      { title: 'Popular apps on your device', data: filteredCurated },
      { title: 'Other apps on your device', data: filteredUser },
    ].filter((s) => s.data.length > 0);
  }, [curatedApps, userApps, search]);

  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      await MonitorService.init(Array.from(selected));
      navigation.navigate('IntensitySelection');
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AppItem }) => (
    <AppRow
      item={item}
      isSelected={selected.has(item.packageName)}
      onToggle={toggle}
      styles={styles}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.step}>Step 3 of 3</Text>
        <Text style={styles.title}>Which apps do you want to watch?</Text>
        <Text style={styles.subtitle}>Only apps installed on your device are shown.</Text>
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
            ListEmptyComponent={<Text style={styles.emptyMsg}>No apps match "{search}"</Text>}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selected.size} selected</Text>
        {selected.size === 0 && (
          <View style={styles.nudgeBanner}>
            <Text style={styles.nudgeText}>
              ⚠ No apps selected — ScrollGuard won't track or nudge anything yet.
              You can change this later from the dashboard.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleDone}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {selected.size === 0 ? 'Skip for now →' : 'Start watching →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
