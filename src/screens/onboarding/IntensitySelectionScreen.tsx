import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { SG, SgFonts } from '../../theme';
import {
  SgScreen,
  SgButton,
  BackLink,
  StepPill,
} from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'IntensitySelection'>;

const LEVELS: IntensityLevel[] = ['gentle', 'balanced', 'strict'];

const LEVEL_ACCENT: Record<IntensityLevel, { accent: string; soft: string; line: string }> = {
  gentle:   { accent: SG.gentle,   soft: SG.gentleSoft,   line: SG.gentleLine },
  balanced: { accent: SG.balanced, soft: SG.balancedSoft, line: SG.balancedLine },
  strict:   { accent: SG.strict,   soft: SG.strictSoft,   line: SG.strictLine },
};

function PaceCard({
  level,
  selected,
  onSelect,
}: {
  level: IntensityLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  const preset = INTENSITY_PRESETS[level];
  const { accent, soft, line } = LEVEL_ACCENT[level];

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.8}
      style={[
        cardStyles.card,
        selected ? { backgroundColor: soft, borderColor: line } : {},
      ]}
    >
      <View style={cardStyles.header}>
        <View style={[cardStyles.dot, { backgroundColor: accent }]} />
        <View style={{ flex: 1 }}>
          <View style={cardStyles.titleRow}>
            <Text style={[cardStyles.name, selected && { color: accent }]}>{preset.label}</Text>
            <Text style={cardStyles.tag}>· {preset.tagline}</Text>
          </View>
        </View>
        <View style={[cardStyles.radio, { borderColor: selected ? accent : SG.line }]}>
          {selected && <View style={[cardStyles.radioFill, { backgroundColor: accent }]} />}
        </View>
      </View>

      <Text style={cardStyles.desc}>{preset.description}</Text>

      <View style={cardStyles.statsRow}>
        {[
          ['BASELINE', `${preset.sampleDays}d`],
          ['WEEKLY CUT', `−${Math.round(preset.weeklyReductionPct * 100)}%`],
          ['COOLDOWN',   `${preset.cooldownMinutes}m`],
        ].map(([label, value]) => (
          <View key={label} style={{ flex: 1 }}>
            <Text style={cardStyles.statLabel}>{label}</Text>
            <Text style={[cardStyles.statValue, selected && { color: SG.fg }]}>{value}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    padding: 18,
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: SgFonts.uiSemiBold, fontSize: 18, color: SG.fg },
  tag: { fontFamily: SgFonts.ui, fontSize: 12, color: SG.fg3 },
  radio: {
    width: 20, height: 20, borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  radioFill: { width: 10, height: 10, borderRadius: 999 },
  desc: {
    fontFamily: SgFonts.ui,
    fontSize: 13.5,
    color: SG.fg2,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: SG.lineSoft,
    gap: 8,
  },
  statLabel: {
    fontFamily: SgFonts.mono,
    fontSize: 9.5,
    color: SG.fg3,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: SgFonts.display,
    fontSize: 22,
    color: SG.fg,
    lineHeight: 26,
  },
});

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
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackLink onPress={() => navigation.goBack()} />
        <View style={{ marginTop: 12 }}>
          <StepPill n={4} total={4} />
        </View>

        <Text style={styles.headline}>
          How fast should{'\n'}we improve?
        </Text>
        <Text style={styles.sub}>
          Controls how quickly ScrollGuard tightens your targets and how firmly it nudges you. You can change this anytime.
        </Text>

        <View style={styles.cards}>
          {LEVELS.map((level) => (
            <PaceCard
              key={level}
              level={level}
              selected={selected === level}
              onSelect={() => setSelected(level)}
            />
          ))}
        </View>

        <View style={{ height: 18 }} />
        <SgButton
          onPress={handleStart}
          disabled={saving}
          label={saving ? 'Starting…' : 'Start ScrollGuard →'}
        />
        <View style={{ height: 16 }} />
      </ScrollView>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
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
    marginTop: 14,
    marginBottom: 4,
  },
  cards: { marginTop: 20, gap: 12 },
});
