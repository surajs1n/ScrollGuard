import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, AppUsage } from '../../modules/UsageStats';
import {
  getStreak,
  getActivityCompletionsForDate,
  logActivityCompletion,
  removeActivityCompletion,
  recordStreakDay,
  getWeeklyUsageTotals,
  upsertUsageSnapshot,
  todayString,
  StreakData,
} from '../../storage/db';
import { MonitorService } from '../../modules/MonitorService';
import {
  INTENSITY_PRESETS,
  getBannerPhase,
  DEFAULT_INTENSITY,
  IntensityLevel,
  BannerPhase,
} from '../../config/intensityPresets';
import { getGreeting, parseGreeting } from '../../config/greetings';
import activities from '../../data/activities.json';
import { useTheme } from '../../ThemeContext';
import { SG, SgFonts } from '../../theme';
import { SgScreen, SgMark, SgEyebrow } from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface Activity {
  id: string;
  label: string;
  durationMin: number;
  category: string;
}

const ALL_ACTIVITIES: Activity[] = activities as Activity[];
const BAR_H = 140;
const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function msToMin(ms: number) { return Math.round(ms / 60_000); }

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function weekRangeLabel(data: { date: string }[]): string {
  if (data.length < 7) return '';
  const s = new Date(data[0].date);
  const e = new Date(data[6].date);
  if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
  return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}

function pickActivities(n = 3): Activity[] {
  return [...ALL_ACTIVITIES].sort(() => Math.random() - 0.5).slice(0, n);
}

function phaseBadgeText(
  phase: BannerPhase,
  preset: ReturnType<typeof INTENSITY_PRESETS['balanced']['sampleDays'] extends number ? () => typeof INTENSITY_PRESETS['balanced'] : never>,
  daysSinceInstall: number,
  currentWeek: number,
  sampleDays: number,
): string {
  if (phase === 'observer') {
    return `DAY ${daysSinceInstall + 1} OF ${sampleDays} · OBSERVING`;
  }
  const phaseLabel: Record<BannerPhase, string> = {
    observer:    'OBSERVING',
    active:      'ACTIVE',
    progress:    'BUILDING',
    maintenance: 'MAINTAINED',
  };
  return `WEEK ${currentWeek} · ${phaseLabel[phase]}`;
}

// ── Weekly bar chart ──────────────────────────────────────────

function WeekChart({
  data,
  accent,
  today,
  onPrev,
  onNext,
  canGoNext,
  rangeLabel,
  targetMin,
}: {
  data: { date: string; totalMs: number }[];
  accent: string;
  today: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
  rangeLabel: string;
  targetMin: number;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (data.length < 7) return null;

  const maxMs = Math.max(...data.map((d) => d.totalMs), targetMin * 60_000 * 1.5, 60_000);
  const targetRatio = targetMin > 0 ? (targetMin * 60_000) / maxMs : 0;
  const targetY = (1 - targetRatio) * BAR_H;

  return (
    <View style={chartStyles.card}>
      {/* Header row */}
      <View style={chartStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <SgEyebrow>This week</SgEyebrow>
          <Text style={chartStyles.rangeLabel}>{rangeLabel}</Text>
        </View>
        <View style={chartStyles.navRow}>
          <TouchableOpacity onPress={onPrev} style={chartStyles.navBtn} activeOpacity={0.7}>
            <Text style={chartStyles.navArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            style={chartStyles.navBtn}
            disabled={!canGoNext}
            activeOpacity={canGoNext ? 0.7 : 0.3}
          >
            <Text style={[chartStyles.navArrow, !canGoNext && { color: SG.line }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart body */}
      <View style={{ position: 'relative', marginTop: 16, height: BAR_H }}>
        {/* Dashed target line */}
        {targetMin > 0 && (
          <>
            <View style={[chartStyles.targetLine, { top: targetY }]} />
            <Text style={[chartStyles.targetLabel, { top: targetY - 9 }]}>
              {targetMin}m · target
            </Text>
          </>
        )}

        {/* Bars */}
        <View style={chartStyles.barsRow}>
          {data.map((d, i) => {
            const isToday = d.date === today;
            const isFuture = d.totalMs === 0 && d.date > today;
            const overTarget = targetMin > 0 && msToMin(d.totalMs) > targetMin;
            const ratio = d.totalMs / maxMs;
            const barH = Math.max(4, ratio * BAR_H);
            const isSelected = selectedDay === i;

            let barColor = '#2D3A58'; // past/default muted blue
            if (isToday) barColor = accent;
            else if (overTarget) barColor = SG.strict + 'CC';

            return (
              <TouchableOpacity
                key={i}
                style={chartStyles.barCol}
                onPress={() => setSelectedDay(isSelected ? null : i)}
                activeOpacity={0.75}
              >
                {isSelected && d.totalMs > 0 && (
                  <Text style={[chartStyles.barTooltip, { color: isToday ? accent : SG.fg2 }]}>
                    {fmtMin(msToMin(d.totalMs))}
                  </Text>
                )}
                <View style={{ width: '100%', height: BAR_H, justifyContent: 'flex-end' }}>
                  {isFuture ? (
                    <View style={chartStyles.futureBar} />
                  ) : (
                    <View style={[chartStyles.bar, { height: barH, backgroundColor: barColor }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Day labels */}
      <View style={chartStyles.labelsRow}>
        {DAY_SHORT.map((d, i) => (
          <Text
            key={i}
            style={[
              chartStyles.dayLabel,
              data[i]?.date === today && { color: accent, fontFamily: SgFonts.monoMedium },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
    padding: 18,
    marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  rangeLabel: {
    fontFamily: SgFonts.display,
    fontSize: 22,
    color: SG.fg,
    letterSpacing: -0.2,
    marginTop: 4,
  },
  navRow: { flexDirection: 'row', gap: 4 },
  navBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, borderColor: SG.lineSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  navArrow: { fontFamily: SgFonts.ui, fontSize: 18, color: SG.fg2 },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: SG.line,
    borderStyle: 'dashed',
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg3,
  },
  barsRow: {
    position: 'absolute',
    left: 0,
    right: 52,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: BAR_H },
  barTooltip: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    position: 'absolute',
    top: -14,
  },
  bar: { width: '100%', borderRadius: 5 },
  futureBar: {
    width: '100%',
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderStyle: 'dashed',
  },
  labelsRow: { flexDirection: 'row', marginTop: 10, gap: 6, paddingRight: 52 },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: SgFonts.mono,
    fontSize: 11,
    color: SG.fg3,
  },
});

// ── Stat tile ─────────────────────────────────────────────────

function StatTile({ label, value, unit, hint }: {
  label: string; value: string; unit?: string; hint?: string;
}) {
  return (
    <View style={statStyles.tile}>
      <SgEyebrow>{label}</SgEyebrow>
      <View style={statStyles.numberRow}>
        <Text style={statStyles.value}>{value}</Text>
        {unit && <Text style={statStyles.unit}>{unit}</Text>}
      </View>
      {hint != null && (
        <Text style={statStyles.hint} numberOfLines={1}>{hint}</Text>
      )}
    </View>
  );
}

const statStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
    padding: 16,
  },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 8, lineHeight: 1 },
  value: {
    fontFamily: SgFonts.displayItalic,
    fontSize: 42,
    color: SG.fg,
    lineHeight: 44,
  },
  unit: {
    fontFamily: SgFonts.uiMedium,
    fontSize: 13,
    color: SG.fg3,
    marginBottom: 4,
  },
  hint: {
    fontFamily: SgFonts.mono,
    fontSize: 10.5,
    color: SG.fg4,
    marginTop: 8,
  },
});

// ── App breakdown row ─────────────────────────────────────────

function AppBreakdownRow({
  name,
  mins,
  targetMin,
  isLast,
  accent,
}: {
  name: string;
  mins: number;
  targetMin: number;
  isLast: boolean;
  accent: string;
}) {
  const over = targetMin > 0 && mins > targetMin;
  const barMax = targetMin > 0 ? targetMin * 1.5 : Math.max(mins, 60);
  const barPct = Math.min(1, mins / barMax);
  const tickPct = targetMin > 0 ? targetMin / barMax : 0;
  const barColor = over ? SG.strict : accent;

  return (
    <View style={[breakdownStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: SG.lineSoft }]}>
      <View style={breakdownStyles.topRow}>
        <View style={[breakdownStyles.avatar, { backgroundColor: SG.bg2 }]}>
          <Text style={breakdownStyles.avatarLetter}>{name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={breakdownStyles.appName} numberOfLines={1}>{name}</Text>
        <View style={breakdownStyles.timeRow}>
          <Text style={[breakdownStyles.timeVal, over && { color: SG.strict }]}>{mins}</Text>
          <Text style={breakdownStyles.timeUnit}>m</Text>
        </View>
      </View>
      {/* Progress bar */}
      <View style={breakdownStyles.track}>
        <View style={[breakdownStyles.fill, { width: `${barPct * 100}%`, backgroundColor: barColor }]} />
        {tickPct > 0 && (
          <View style={[breakdownStyles.tick, { left: `${tickPct * 100}%` }]} />
        )}
      </View>
      <View style={breakdownStyles.bottomRow}>
        <Text style={breakdownStyles.bottomText}>
          {targetMin > 0
            ? (over ? `+${mins - targetMin}m over target` : `${targetMin - mins}m under target`)
            : `${mins}m today`}
        </Text>
        {targetMin > 0 && <Text style={breakdownStyles.bottomText}>TARGET · {targetMin}m</Text>}
      </View>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  row: { padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarLetter: { fontFamily: SgFonts.uiSemiBold, fontSize: 13, color: SG.fg3 },
  appName: { flex: 1, fontFamily: SgFonts.uiMedium, fontSize: 14.5, color: SG.fg },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  timeVal: { fontFamily: SgFonts.displayItalic, fontSize: 22, color: SG.fg, lineHeight: 24 },
  timeUnit: { fontFamily: SgFonts.ui, fontSize: 12, color: SG.fg3, marginBottom: 1 },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: SG.bg2,
    marginTop: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  tick: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 1.5,
    backgroundColor: SG.fg3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bottomText: { fontFamily: SgFonts.mono, fontSize: 10.5, color: SG.fg4 },
});

// ── Suggestion card ───────────────────────────────────────────

function SuggestionCard({
  activity,
  done,
  onPress,
  accent,
  accentSoft,
  accentLine,
  isLast,
}: {
  activity: Activity;
  done: boolean;
  onPress: () => void;
  accent: string;
  accentSoft: string;
  accentLine: string;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        suggStyles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: SG.lineSoft },
      ]}
    >
      <View style={suggStyles.iconBox}>
        <Text style={[suggStyles.iconText, { color: accent }]}>✦</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[suggStyles.title, done && { textDecorationLine: 'line-through', color: SG.fg3 }]}>
          {activity.label}
        </Text>
        <Text style={suggStyles.meta}>
          {activity.durationMin} MIN · {activity.category.toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          suggStyles.doneBtn,
          done
            ? { backgroundColor: 'transparent', borderColor: SG.gentleLine }
            : { backgroundColor: accentSoft, borderColor: accentLine },
        ]}
      >
        <Text style={[suggStyles.doneBtnText, { color: done ? SG.gentle : accent }]}>
          {done ? '✓ Done' : 'I did it'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const suggStyles = StyleSheet.create({
  row: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: SG.bg2,
    borderWidth: 1, borderColor: SG.lineSoft,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 16 },
  title: { fontFamily: SgFonts.uiMedium, fontSize: 14.5, color: SG.fg, letterSpacing: -0.1 },
  meta: { fontFamily: SgFonts.mono, fontSize: 11, color: SG.fg3, marginTop: 3 },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  doneBtnText: { fontFamily: SgFonts.uiMedium, fontSize: 12.5 },
});

// ── Section header (eyebrow + count) ─────────────────────────

function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <View style={secStyles.row}>
      <Text style={secStyles.title}>{title.toUpperCase()}</Text>
      {count && <Text style={secStyles.count}>{count}</Text>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  title: { fontFamily: SgFonts.mono, fontSize: 11.5, color: SG.fg3, letterSpacing: 1.1 },
  count: { fontFamily: SgFonts.mono, fontSize: 10.5, color: SG.fg4 },
});

// ── Main screen ───────────────────────────────────────────────

export default function DashboardScreen({ route, navigation }: Props) {
  const openSuggestion = route.params?.openSuggestion ?? false;
  const { accent, accentSoft, accentLine, intensity, refreshTheme } = useTheme();

  const [todayUsage, setTodayUsage]     = useState<AppUsage[]>([]);
  const [streak, setStreak]             = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  const [completedToday, setCompleted]  = useState<string[]>([]);
  const [suggestedActivities]           = useState<Activity[]>(() => pickActivities(3));
  const [currentWeek, setCurrentWeek]   = useState(1);
  const [daysSinceInstall, setDays]     = useState(0);
  const [weeklyData, setWeeklyData]     = useState<{ date: string; totalMs: number }[]>([]);
  const [chartWeekOffset, setOffset]    = useState(0);
  const [refreshing, setRefreshing]     = useState(false);
  const [showSuggestions, setShowSugg]  = useState(openSuggestion);

  const today = useMemo(() => todayString(), []);

  const loadData = useCallback(async () => {
    const [todayArr, streakData, completions, week, weekData, installDate] = await Promise.all([
      UsageStats.getTodayUsage().catch(() => [] as AppUsage[]),
      getStreak(),
      getActivityCompletionsForDate(today),
      MonitorService.getCurrentWeek(),
      getWeeklyUsageTotals(0),
      MonitorService.getInstallDate(),
    ]);

    setTodayUsage(todayArr);
    setStreak(streakData);
    setCompleted(completions.map((c) => c.activityId));
    setCurrentWeek(week);
    setDays(installDate ? Math.floor((Date.now() - installDate) / 86_400_000) : 0);
    setWeeklyData(weekData);
    setOffset(0);

    await Promise.all(
      todayArr.map((u) =>
        upsertUsageSnapshot({ date: today, packageName: u.packageName, appName: u.appName, totalTimeMs: u.totalTimeMs })
      )
    );
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); refreshTheme(); }, [loadData, refreshTheme]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => { if (s === 'active') loadData(); });
    return () => sub.remove();
  }, [loadData]);

  const handleChartWeekChange = useCallback(async (newOffset: number) => {
    if (newOffset > 0) return;
    setOffset(newOffset);
    const data = await getWeeklyUsageTotals(newOffset);
    setWeeklyData(data);
  }, []);

  const handleActivityDone = async (activity: Activity) => {
    if (completedToday.includes(activity.id)) {
      Alert.alert('Undo completion?', `Unmark "${activity.label}" as done?`, [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            await removeActivityCompletion(activity.id);
            setCompleted((prev) => prev.filter((id) => id !== activity.id));
          },
        },
      ]);
      return;
    }
    await logActivityCompletion(activity.id, activity.label);
    const newStreak = await recordStreakDay();
    setCompleted((prev) => [...prev, activity.id]);
    setStreak(newStreak);
    Alert.alert('Nice work!', `You completed: ${activity.label}`);
  };

  const preset = INTENSITY_PRESETS[intensity];
  const phase = getBannerPhase(daysSinceInstall, currentWeek, preset);
  const badgeText = (() => {
    if (phase === 'observer') return `DAY ${daysSinceInstall + 1} OF ${preset.sampleDays} · OBSERVING`;
    const labels: Record<typeof phase, string> = { observer: 'OBSERVING', active: 'ACTIVE', progress: 'BUILDING', maintenance: 'MAINTAINED' };
    return `WEEK ${currentWeek} · ${labels[phase]}`;
  })();

  const todayTotal = todayUsage.reduce((s, u) => s + u.totalTimeMs, 0);
  const todayMin = msToMin(todayTotal);

  // Greeting: count good days this week (days with data and under target)
  const targetMin = phase !== 'observer' ? preset.baselineCapMinutes : 0;
  const goodDaysThisWeek = weeklyData.filter(
    (d) => d.date <= today && d.date !== today && d.totalMs > 0 && msToMin(d.totalMs) <= targetMin
  ).length;
  const greetingText = getGreeting({
    phase,
    intensity,
    todayMin,
    targetMin,
    goodDaysThisWeek,
    streak: streak.currentStreak,
    hour: new Date().getHours(),
  });
  const greetingSegments = parseGreeting(greetingText);

  // Per-app daily target proxy: baseline cap divided across monitored apps
  const perAppTargetMin = todayUsage.length > 0
    ? Math.round(preset.baselineCapMinutes / todayUsage.length)
    : 0;


  const totalHours = Math.floor(todayMin / 60);
  const totalMins  = todayMin % 60;
  const totalDisplay = totalHours > 0 ? `${totalHours}:${String(totalMins).padStart(2,'0')}` : String(todayMin);
  const totalUnit    = totalHours > 0 ? 'h' : 'min';

  return (
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={accent}
          />
        }
      >
        {/* ── Header ── */}
        <View style={headerStyles.row}>
          <SgMark size={34} accent={accent} />
          <View style={{ flex: 1 }}>
            <Text style={headerStyles.wordmark}>ScrollGuard</Text>
            <View style={[headerStyles.badge, { backgroundColor: accentSoft }]}>
              <View style={[headerStyles.badgeDot, { backgroundColor: accent }]} />
              <Text style={[headerStyles.badgeText, { color: accent }]}>{badgeText}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={headerStyles.gear}
            activeOpacity={0.7}
          >
            <Text style={headerStyles.gearIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* ── Greeting ── */}
        <View style={greetStyles.section}>
          <Text style={greetStyles.date}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </Text>
          <Text
            style={greetStyles.headline}
            adjustsFontSizeToFit
            numberOfLines={2}
            minimumFontScale={0.8}
          >
            {greetingSegments.map((seg, i) =>
              seg.italic ? (
                <Text key={i} style={[greetStyles.italic, { color: accent }]}>{seg.text}</Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              )
            )}
          </Text>
        </View>

        {/* ── Chart ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
          <WeekChart
            data={weeklyData}
            accent={accent}
            today={today}
            onPrev={() => handleChartWeekChange(chartWeekOffset - 1)}
            onNext={() => handleChartWeekChange(chartWeekOffset + 1)}
            canGoNext={chartWeekOffset < 0}
            rangeLabel={weekRangeLabel(weeklyData)}
            targetMin={targetMin}
          />
        </View>

        {/* ── Stat tiles ── */}
        <View style={statRowStyles.row}>
          <StatTile
            label="STREAK"
            value={String(streak.currentStreak)}
            hint={streak.longestStreak > 0 ? `best: ${streak.longestStreak} days` : 'under-target days'}
          />
          <StatTile
            label="TODAY"
            value={totalDisplay}
            unit={totalUnit}
            hint={`across ${todayUsage.length} app${todayUsage.length !== 1 ? 's' : ''}`}
          />
        </View>

        {/* ── App breakdown ── */}
        <View style={secWrapStyles.wrap}>
          <SectionHeader
            title="Today's breakdown"
            count={`${todayUsage.length} OF ${todayUsage.length} APPS`}
          />
          <View style={[secWrapStyles.card, { overflow: 'hidden' }]}>
            {todayUsage.length === 0 ? (
              <Text style={secWrapStyles.empty}>No usage data yet. Pull to refresh.</Text>
            ) : (
              todayUsage.map((u, i) => (
                <AppBreakdownRow
                  key={u.packageName}
                  name={u.appName}
                  mins={msToMin(u.totalTimeMs)}
                  targetMin={perAppTargetMin}
                  isLast={i === todayUsage.length - 1}
                  accent={accent}
                />
              ))
            )}
          </View>
        </View>

        {/* ── Suggestions ── */}
        <View style={secWrapStyles.wrap}>
          <TouchableOpacity onPress={() => setShowSugg((v) => !v)}>
            <SectionHeader
              title="Instead of scrolling"
              count={`${suggestedActivities.length} IDEAS`}
            />
          </TouchableOpacity>
          {showSuggestions && (
            <View style={[secWrapStyles.card, { overflow: 'hidden' }]}>
              {suggestedActivities.map((a, i) => (
                <SuggestionCard
                  key={a.id}
                  activity={a}
                  done={completedToday.includes(a.id)}
                  onPress={() => handleActivityDone(a)}
                  accent={accent}
                  accentSoft={accentSoft}
                  accentLine={accentLine}
                  isLast={i === suggestedActivities.length - 1}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 18 }} />
        <View style={footerStyles.row}>
          <SgMark size={18} accent={accent} />
          <Text style={footerStyles.text}>SCROLLGUARD · ON-DEVICE</Text>
        </View>
        <View style={{ height: 28 }} />
      </ScrollView>
    </SgScreen>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
  },
  wordmark: { fontFamily: SgFonts.uiSemiBold, fontSize: 19, color: SG.fg, letterSpacing: -0.5, lineHeight: 22 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 999 },
  badgeText: { fontFamily: SgFonts.mono, fontSize: 10, letterSpacing: 0.5 },
  gear: {
    width: 38, height: 38, borderRadius: 999,
    borderWidth: 1, borderColor: SG.lineSoft,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  gearIcon: { fontSize: 17, color: SG.fg2 },
});

const greetStyles = StyleSheet.create({
  section: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },
  date: { fontFamily: SgFonts.mono, fontSize: 11, color: SG.fg3, letterSpacing: 0.5 },
  headline: {
    fontFamily: SgFonts.display,
    fontSize: 36,
    color: SG.fg,
    letterSpacing: -0.7,
    lineHeight: 42,
    marginTop: 8,
  },
  italic: { fontFamily: SgFonts.displayItalic, fontSize: 36, lineHeight: 42 },
});


const statRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 22, paddingTop: 14, gap: 12 },
});

const secWrapStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 22, paddingTop: 20 },
  card: {
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
  },
  empty: {
    fontFamily: SgFonts.ui,
    fontSize: 14,
    color: SG.fg3,
    padding: 16,
    textAlign: 'center',
  },
});

const footerStyles = StyleSheet.create({
  row: { alignItems: 'center', gap: 8, justifyContent: 'center', flexDirection: 'row' },
  text: { fontFamily: SgFonts.mono, fontSize: 10.5, color: SG.fg4, letterSpacing: 0.8 },
});
