import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, CuratedApp, InstalledApp } from '../../modules/UsageStats';
import { MonitorService } from '../../modules/MonitorService';
import { SG, SgFonts } from '../../theme';
import { useTheme } from '../../ThemeContext';
import {
  SgScreen,
  SgButton,
  BackLink,
} from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'MonitoredApps'>;
type AppItem = { packageName: string; appName: string };
type Section = { title: string; data: AppItem[] };

function initColor(str: string): string {
  const palette = [SG.strict, SG.balanced, SG.gentle, SG.amber, '#7B52AB', '#1DA462'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return palette[Math.abs(h) % palette.length];
}

function AppRow({
  item,
  isSelected,
  onToggle,
  accent,
  accentSoft,
  accentLine,
}: {
  item: AppItem;
  isSelected: boolean;
  onToggle: (pkg: string) => void;
  accent: string;
  accentSoft: string;
  accentLine: string;
}) {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    UsageStats.getAppIcon(item.packageName).then((b64) => {
      if (!cancelled && b64) setIcon(b64);
    });
    return () => { cancelled = true; };
  }, [item.packageName]);

  const color = initColor(item.packageName);

  return (
    <TouchableOpacity
      style={[
        rowStyles.row,
        isSelected
          ? { backgroundColor: accentSoft, borderColor: accentLine }
          : { backgroundColor: SG.bg2, borderColor: SG.lineSoft },
      ]}
      onPress={() => onToggle(item.packageName)}
      activeOpacity={0.75}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: color }]}>
        {icon ? (
          <Image source={{ uri: `data:image/png;base64,${icon}` }} style={rowStyles.icon} />
        ) : (
          <Text style={rowStyles.initial}>{item.appName[0]?.toUpperCase()}</Text>
        )}
      </View>
      <Text style={rowStyles.name} numberOfLines={1}>{item.appName}</Text>
      <View style={[
        rowStyles.check,
        isSelected ? { backgroundColor: accent, borderColor: accent } : { borderColor: SG.line },
      ]}>
        {isSelected && <Text style={rowStyles.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SG.rMd,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  icon: { width: 36, height: 36, borderRadius: 10 },
  initial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  name: { flex: 1, fontFamily: SgFonts.uiMedium, fontSize: 14.5, color: SG.fg },
  check: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default function MonitoredAppsScreen({ navigation }: Props) {
  const { accent, accentSoft, accentLine } = useTheme();

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
      setCuratedApps(
        curated.filter((a) => a.installed).sort((a, b) => a.appName.localeCompare(b.appName))
      );
      setUserApps(user);
      setSelected(new Set(monitored));
      setLoading(false);
    }
    load();
  }, []);

  const sections: Section[] = useMemo(() => {
    const q = search.toLowerCase();
    const matches = (name: string, pkg: string) =>
      !q || name.toLowerCase().includes(q) || pkg.toLowerCase().includes(q);
    return [
      {
        title: 'Popular apps on your device',
        data: curatedApps
          .filter((a) => matches(a.appName, a.packageName))
          .map((a) => ({ packageName: a.packageName, appName: a.appName })),
      },
      {
        title: 'Other apps on your device',
        data: userApps
          .filter((a) => matches(a.appName, a.packageName))
          .map((a) => ({ packageName: a.packageName, appName: a.appName })),
      },
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

  return (
    <SgScreen style={{ paddingHorizontal: 24, paddingTop: 20 }}>
      {/* Header */}
      <BackLink onPress={() => navigation.goBack()} />
      <Text style={styles.headline}>Monitored{'\n'}apps</Text>
      <Text style={styles.sub}>
        ScrollGuard tracks and nudges you on these apps. Only apps installed on your device are shown.
      </Text>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: SG.fg }]}
          placeholder="Search apps…"
          placeholderTextColor={SG.fg4}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
          sections={sections}
          keyExtractor={(item) => item.packageName}
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => (
            <AppRow
              item={item}
              isSelected={selected.has(item.packageName)}
              onToggle={toggle}
              accent={accent}
              accentSoft={accentSoft}
              accentLine={accentLine}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No apps match "{search}"</Text>
          }
        />
      )}

      {/* Footer */}
      <View style={{ paddingTop: 12, paddingBottom: 16 }}>
        <Text style={styles.count}>
          {selected.size > 0 ? `${selected.size} SELECTED` : '0 SELECTED'}
        </Text>
        {selected.size === 0 && (
          <Text style={styles.warning}>
            No apps selected — ScrollGuard won't track or nudge anything.
          </Text>
        )}
        <View style={{ height: 10 }} />
        <SgButton
          onPress={handleSave}
          disabled={saving}
          label={saving ? 'Saving…' : 'Save changes'}
        />
      </View>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: SgFonts.display,
    fontSize: 38,
    color: SG.fg,
    letterSpacing: -0.8,
    lineHeight: 42,
    marginTop: 18,
  },
  sub: {
    fontFamily: SgFonts.ui,
    fontSize: 14,
    color: SG.fg3,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 18,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    backgroundColor: SG.bg2,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rMd,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 4,
  },
  searchIcon: { fontSize: 14, opacity: 0.6 },
  searchInput: {
    flex: 1,
    fontFamily: SgFonts.ui,
    fontSize: 14,
    paddingVertical: 0,
  },
  sectionHeader: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg3,
    letterSpacing: 1.2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  empty: {
    fontFamily: SgFonts.ui,
    fontSize: 14,
    color: SG.fg3,
    padding: 16,
    textAlign: 'center',
  },
  count: {
    fontFamily: SgFonts.mono,
    fontSize: 11.5,
    color: SG.fg3,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  warning: {
    fontFamily: SgFonts.ui,
    fontSize: 12,
    color: SG.amber,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
});
