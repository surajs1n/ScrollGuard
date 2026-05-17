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
  StepPill,
} from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSelection'>;
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

export default function AppSelectionScreen({ navigation }: Props) {
  const { accent, accentSoft, accentLine } = useTheme();

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
      setCuratedApps(curated.filter((a) => a.installed).sort((a, b) => a.appName.localeCompare(b.appName)));
      setUserApps(user);
      setLoading(false);
    });
  }, []);

  const sections: Section[] = useMemo(() => {
    const q = search.toLowerCase();
    const matches = (name: string, pkg: string) =>
      !q || name.toLowerCase().includes(q) || pkg.toLowerCase().includes(q);
    return [
      {
        title: 'Popular apps on your device',
        data: curatedApps.filter((a) => matches(a.appName, a.packageName))
          .map((a) => ({ packageName: a.packageName, appName: a.appName })),
      },
      {
        title: 'Other apps on your device',
        data: userApps.filter((a) => matches(a.appName, a.packageName))
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

  return (
    <SgScreen style={{ paddingHorizontal: 24, paddingTop: 20 }}>
      {/* Header */}
      <BackLink onPress={() => navigation.goBack()} />
      <View style={{ marginTop: 12 }}>
        <StepPill n={3} total={3} />
      </View>
      <Text style={styles.headline}>
        Which apps{'\n'}should I watch?
      </Text>
      <Text style={styles.sub}>
        Only apps installed on your device are shown. You can change this anytime.
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
        <View style={{ height: 10 }} />
        <SgButton
          onPress={handleDone}
          disabled={saving}
          label={saving ? 'Saving…' : selected.size === 0 ? 'Skip for now →' : 'Start watching →'}
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
    fontSize: 14.5,
    color: SG.fg3,
    lineHeight: 21,
    letterSpacing: -0.1,
    marginTop: 14,
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
});
