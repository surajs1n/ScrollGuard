import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
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
  INTENSITY_MESSAGES,
  getBannerPhase,
  DEFAULT_INTENSITY,
  IntensityLevel,
} from '../../config/intensityPresets';
import activities from '../../data/activities.json';
import { useTheme, spacing, font } from '../../ThemeContext';
import { AppColors } from '../../ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface Activity {
  id: string;
  label: string;
  durationMin: number;
  category: string;
}

const ALL_ACTIVITIES: Activity[] = activities as Activity[];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_CHART_HEIGHT = 120;

function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function pickRandomActivities(count = 3): Activity[] {
  return [...ALL_ACTIVITIES].sort(() => Math.random() - 0.5).slice(0, count);
}

function weekRangeLabel(data: { date: string }[]): string {
  if (data.length < 7) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(data[0].date);
  const e = new Date(data[6].date);
  if (s.getMonth() === e.getMonth()) {
    return `${months[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`;
}

function makeChartStyles(c: AppColors) {
  return StyleSheet.create({
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: BAR_CHART_HEIGHT + 24,
      gap: 5,
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: BAR_CHART_HEIGHT + 24,
    },
    barTooltip: {
      color: c.textPrimary,
      fontSize: 10,
      fontWeight: '700' as const,
      marginBottom: 3,
      backgroundColor: c.bg,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      overflow: 'hidden' as const,
    },
    barTrack: { width: '100%', height: BAR_CHART_HEIGHT, justifyContent: 'flex-end' as const },
    bar: { width: '100%', borderRadius: 4 },
    barDefault: { backgroundColor: c.accent, opacity: 0.65 },
    barSelected: { backgroundColor: c.accentLight, opacity: 1 },
    labelsRow: { flexDirection: 'row' as const, marginTop: 6, gap: 5 },
    dayLabel: { flex: 1, textAlign: 'center' as const, fontSize: 10, color: c.textSecondary },
    dayLabelSelected: { color: c.accentLight, fontWeight: '700' as const },
  });
}

function WeeklyBarChart({
  data,
  selectedDay,
  onDayPress,
}: {
  data: { date: string; totalMs: number }[];
  selectedDay: number | null;
  onDayPress: (i: number | null) => void;
}) {
  const { colors } = useTheme();
  const chartStyles = useMemo(() => makeChartStyles(colors), [colors]);

  if (data.length < 7) return null;
  const maxMs = Math.max(...data.map((d) => d.totalMs), 60_000);

  return (
    <View>
      <View style={chartStyles.barsRow}>
        {data.map((d, i) => {
          const ratio = d.totalMs / maxMs;
          const barH = Math.max(4, ratio * BAR_CHART_HEIGHT);
          const isSelected = selectedDay === i;
          return (
            <TouchableOpacity
              key={i}
              style={chartStyles.barCol}
              onPress={() => onDayPress(isSelected ? null : i)}
              activeOpacity={0.7}
            >
              {isSelected && d.totalMs > 0 && (
                <Text style={chartStyles.barTooltip}>
                  {formatMinutes(msToMinutes(d.totalMs))}
                </Text>
              )}
              <View style={chartStyles.barTrack}>
                <View
                  style={[
                    chartStyles.bar,
                    { height: barH },
                    isSelected ? chartStyles.barSelected : chartStyles.barDefault,
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={chartStyles.labelsRow}>
        {DAY_LABELS.map((label, i) => (
          <Text
            key={i}
            style={[chartStyles.dayLabel, selectedDay === i && chartStyles.dayLabelSelected]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: { fontSize: font.lg, fontWeight: '700', color: c.textPrimary },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    weekBadge: {
      backgroundColor: c.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 8,
    },
    weekText: { color: c.accent, fontSize: font.sm, fontWeight: '600' },
    gearBtn: { padding: 4 },
    gearIcon: { fontSize: 28, color: c.accentLight },

    phaseBanner: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: c.accent,
    },
    phaseBannerTitle: { color: c.textPrimary, fontWeight: '600', marginBottom: 4 },
    phaseBannerBody: { color: c.textSecondary, fontSize: font.sm, lineHeight: 20 },

    chartCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    chartNav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    chartNavLeft: { flex: 1, alignItems: 'flex-start' },
    chartNavRight: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    todayBtn: {
      backgroundColor: `${c.accent}22`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.accent,
    },
    todayBtnText: { color: c.accentLight, fontSize: font.xs, fontWeight: '700' },
    navBtn: { width: 28, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    navArrow: { fontSize: 22, color: c.accentLight, fontWeight: '600' },
    navArrowDisabled: { color: c.border },
    chartRangeLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: font.sm,
      fontWeight: '600',
      color: c.textSecondary,
    },

    twinRow: { flexDirection: 'row', marginBottom: spacing.lg },
    twinCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.md,
      alignItems: 'center',
    },
    twinValue: { fontSize: font.xxl, fontWeight: '800', color: c.accent },
    twinLabel: { fontSize: font.xs, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
    twinSub: { fontSize: font.xs, color: c.textSecondary, marginTop: 4 },
    deltaUp: { color: c.danger },
    deltaDown: { color: c.success },

    section: { marginBottom: spacing.lg },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: font.lg,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    sectionToggle: { color: c.textSecondary, fontSize: font.md },

    appRow: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    appInfo: { flex: 1 },
    appName: { fontSize: font.md, fontWeight: '600', color: c.textPrimary },
    appTime: { fontSize: font.sm, color: c.accent, marginTop: 2 },
    appYest: { fontSize: font.xs, color: c.textSecondary },
    emptyMsg: { color: c.textSecondary, fontSize: font.sm, marginTop: spacing.sm },

    activityCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    activityDone: { opacity: 0.55 },
    activityInfo: { flex: 1 },
    activityLabel: { fontSize: font.md, color: c.textPrimary, fontWeight: '500' },
    activityLabelDone: { textDecorationLine: 'line-through' as const },
    activityMeta: { fontSize: font.xs, color: c.textSecondary, marginTop: 4 },
    doneBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
    },
    doneBtnDone: { backgroundColor: c.success },
    doneBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

    privacyFooter: {
      color: c.textSecondary,
      fontSize: font.xs,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
}

export default function DashboardScreen({ route, navigation }: Props) {
  const openSuggestion = route.params?.openSuggestion ?? false;
  const { colors, refreshTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [todayUsage, setTodayUsage] = useState<AppUsage[]>([]);
  const [yesterdayUsage, setYesterdayUsage] = useState<AppUsage[]>([]);
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [suggestedActivities] = useState<Activity[]>(() => pickRandomActivities(3));
  const [currentWeek, setCurrentWeek] = useState(1);
  const [daysSinceInstall, setDaysSinceInstall] = useState(0);
  const [intensity, setIntensity] = useState<IntensityLevel>(DEFAULT_INTENSITY);
  const [weeklyData, setWeeklyData] = useState<{ date: string; totalMs: number }[]>([]);
  const [chartWeekOffset, setChartWeekOffset] = useState(0);
  const [selectedChartDay, setSelectedChartDay] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(openSuggestion);

  const loadData = useCallback(async () => {
    const [today, yesterday, streakData, completions, week, weekData, lvl, installDate] = await Promise.all([
      UsageStats.getTodayUsage().catch(() => []),
      UsageStats.getYesterdayUsage().catch(() => []),
      getStreak(),
      getActivityCompletionsForDate(todayString()),
      MonitorService.getCurrentWeek(),
      getWeeklyUsageTotals(0),
      MonitorService.getIntensity(),
      MonitorService.getInstallDate(),
    ]);

    setTodayUsage(today);
    setYesterdayUsage(yesterday);
    setStreak(streakData);
    setCompletedToday(completions.map((c) => c.activityId));
    setCurrentWeek(week);
    setIntensity(lvl);
    setDaysSinceInstall(
      installDate ? Math.floor((Date.now() - installDate) / 86_400_000) : 0
    );
    setWeeklyData(weekData);
    setChartWeekOffset(0);
    setSelectedChartDay(null);

    await Promise.all(
      today.map((u) =>
        upsertUsageSnapshot({
          date: todayString(),
          packageName: u.packageName,
          appName: u.appName,
          totalTimeMs: u.totalTimeMs,
        })
      )
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshTheme();
    }, [loadData, refreshTheme])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const handleChartWeekChange = useCallback(async (newOffset: number) => {
    if (newOffset > 0) return;
    setChartWeekOffset(newOffset);
    setSelectedChartDay(null);
    const data = await getWeeklyUsageTotals(newOffset);
    setWeeklyData(data);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleActivityDone = async (activity: Activity) => {
    if (completedToday.includes(activity.id)) {
      Alert.alert(
        'Undo completion?',
        `Unmark "${activity.label}" as done?`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Undo',
            style: 'destructive',
            onPress: async () => {
              await removeActivityCompletion(activity.id);
              setCompletedToday((prev) => prev.filter((id) => id !== activity.id));
            },
          },
        ]
      );
      return;
    }
    await logActivityCompletion(activity.id, activity.label);
    const newStreak = await recordStreakDay();
    setCompletedToday((prev) => [...prev, activity.id]);
    setStreak(newStreak);
    Alert.alert('Nice work! 🎉', `You completed: ${activity.label}`);
  };

  const todayTotal = todayUsage.reduce((sum, u) => sum + u.totalTimeMs, 0);
  const yesterdayTotal = yesterdayUsage.reduce((sum, u) => sum + u.totalTimeMs, 0);
  const delta = todayTotal - yesterdayTotal;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ScrollGuard</Text>
          <View style={styles.headerRight}>
            <View style={styles.weekBadge}>
              <Text style={styles.weekText}>Week {currentWeek}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.gearBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Phase-aware personalised banner */}
        {(() => {
          const preset = INTENSITY_PRESETS[intensity];
          const phase = getBannerPhase(daysSinceInstall, currentWeek, preset);
          const msg = INTENSITY_MESSAGES[intensity][phase];
          const borderColor = {
            observer:    colors.accent,
            active:      colors.success,
            progress:    colors.warning,
            maintenance: colors.success,
          }[phase];
          return (
            <View style={[styles.phaseBanner, { borderLeftColor: borderColor }]}>
              <Text style={styles.phaseBannerTitle}>{msg.title(preset, currentWeek)}</Text>
              <Text style={styles.phaseBannerBody}>{msg.body(preset, currentWeek)}</Text>
            </View>
          );
        })()}

        {/* Weekly bar chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartNav}>
            <View style={styles.chartNavLeft}>
              {chartWeekOffset < 0 && (
                <TouchableOpacity
                  onPress={() => handleChartWeekChange(0)}
                  style={styles.todayBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.todayBtnText}>Current week</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chartNavRight}>
              <TouchableOpacity
                onPress={() => handleChartWeekChange(chartWeekOffset - 1)}
                style={styles.navBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.chartRangeLabel}>{weekRangeLabel(weeklyData)}</Text>
              <TouchableOpacity
                onPress={() => handleChartWeekChange(chartWeekOffset + 1)}
                style={styles.navBtn}
                disabled={chartWeekOffset >= 0}
                activeOpacity={chartWeekOffset < 0 ? 0.7 : 0.3}
              >
                <Text style={[styles.navArrow, chartWeekOffset >= 0 && styles.navArrowDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <WeeklyBarChart
            data={weeklyData}
            selectedDay={selectedChartDay}
            onDayPress={(i) => setSelectedChartDay(i)}
          />
        </View>

        {/* Streak + today's total side-by-side */}
        <View style={styles.twinRow}>
          <View style={[styles.twinCard, { marginRight: spacing.sm / 2 }]}>
            <Text style={styles.twinValue}>{streak.currentStreak}</Text>
            <Text style={styles.twinLabel}>day streak 🔥</Text>
            {streak.longestStreak > 0 && (
              <Text style={styles.twinSub}>best: {streak.longestStreak}</Text>
            )}
          </View>
          <View style={[styles.twinCard, { marginLeft: spacing.sm / 2 }]}>
            <Text style={styles.twinValue}>{formatMinutes(msToMinutes(todayTotal))}</Text>
            <Text style={styles.twinLabel}>today's total</Text>
            {yesterdayTotal > 0 && (
              <Text style={[styles.twinSub, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                {delta > 0 ? '↑' : '↓'} {formatMinutes(Math.abs(msToMinutes(delta)))} vs yday
              </Text>
            )}
          </View>
        </View>

        {/* Per-app breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's breakdown</Text>
          {todayUsage.length === 0 ? (
            <Text style={styles.emptyMsg}>No usage data yet. Pull to refresh.</Text>
          ) : (
            todayUsage.map((u) => {
              const yestEntry = yesterdayUsage.find((y) => y.packageName === u.packageName);
              const yestMin = yestEntry ? msToMinutes(yestEntry.totalTimeMs) : null;
              return (
                <View key={u.packageName} style={styles.appRow}>
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{u.appName}</Text>
                    <Text style={styles.appTime}>{formatMinutes(msToMinutes(u.totalTimeMs))}</Text>
                  </View>
                  {yestMin !== null && (
                    <Text style={styles.appYest}>yesterday: {formatMinutes(yestMin)}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Activity suggestions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowSuggestions((v) => !v)}
          >
            <Text style={styles.sectionTitle}>Suggestions</Text>
            <Text style={styles.sectionToggle}>{showSuggestions ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showSuggestions &&
            suggestedActivities.map((activity) => {
              const done = completedToday.includes(activity.id);
              return (
                <TouchableOpacity
                  key={activity.id}
                  style={[styles.activityCard, done && styles.activityDone]}
                  onPress={() => handleActivityDone(activity)}
                  activeOpacity={0.75}
                >
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, done && styles.activityLabelDone]}>
                      {activity.label}
                    </Text>
                    <Text style={styles.activityMeta}>
                      ~{activity.durationMin} min · {activity.category}
                    </Text>
                  </View>
                  <View style={[styles.doneBtn, done && styles.doneBtnDone]}>
                    <Text style={styles.doneBtnText}>{done ? '✓' : 'I did it'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>

        <Text style={styles.privacyFooter}>
          All data stays on your device. Nothing is sent anywhere.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
