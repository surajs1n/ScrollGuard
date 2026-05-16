import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats, AppUsage } from '../../modules/UsageStats';
import {
  getUsageForDate,
  upsertUsageSnapshot,
  getStreak,
  getActivityCompletionsForDate,
  logActivityCompletion,
  recordStreakDay,
  todayString,
  yesterdayString,
  StreakData,
} from '../../storage/db';
import { MonitorService } from '../../modules/MonitorService';
import activities from '../../data/activities.json';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface Activity {
  id: string;
  label: string;
  durationMin: number;
  category: string;
}

const ALL_ACTIVITIES: Activity[] = activities as Activity[];

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
  const shuffled = [...ALL_ACTIVITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function DashboardScreen({ route, navigation }: Props) {
  const openSuggestion = route.params?.openSuggestion ?? false;

  const [todayUsage, setTodayUsage] = useState<AppUsage[]>([]);
  const [yesterdayUsage, setYesterdayUsage] = useState<AppUsage[]>([]);
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [suggestedActivities] = useState<Activity[]>(() => pickRandomActivities(3));
  const [currentWeek, setCurrentWeek] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(openSuggestion);

  const loadData = useCallback(async () => {
    const [today, yesterday, streakData, completions, week] = await Promise.all([
      UsageStats.getTodayUsage().catch(() => []),
      UsageStats.getYesterdayUsage().catch(() => []),
      getStreak(),
      getActivityCompletionsForDate(todayString()),
      MonitorService.getCurrentWeek(),
    ]);

    setTodayUsage(today);
    setYesterdayUsage(yesterday);
    setStreak(streakData);
    setCompletedToday(completions.map((c) => c.activityId));
    setCurrentWeek(week);

    // Persist today's snapshot to SQLite
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
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleActivityDone = async (activity: Activity) => {
    if (completedToday.includes(activity.id)) return;
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

        {/* Week 1 observer mode banner */}
        {currentWeek === 1 && (
          <View style={styles.observerBanner}>
            <Text style={styles.observerTitle}>Observer mode 👁</Text>
            <Text style={styles.observerBody}>
              This week ScrollGuard is watching silently — no nudges yet. Just honest data.
            </Text>
          </View>
        )}

        {/* Streak card */}
        <View style={styles.streakCard}>
          <Text style={styles.streakNumber}>{streak.currentStreak}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
          {streak.longestStreak > 0 && (
            <Text style={styles.streakBest}>best: {streak.longestStreak}</Text>
          )}
        </View>

        {/* Today vs yesterday */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's screen time</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalTime}>{formatMinutes(msToMinutes(todayTotal))}</Text>
            {yesterdayTotal > 0 && (
              <Text style={[styles.delta, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                {delta > 0 ? '↑' : '↓'} {formatMinutes(Math.abs(msToMinutes(delta)))} vs yesterday
              </Text>
            )}
          </View>

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
                <View key={activity.id} style={[styles.activityCard, done && styles.activityDone]}>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, done && styles.activityLabelDone]}>
                      {activity.label}
                    </Text>
                    <Text style={styles.activityMeta}>
                      ~{activity.durationMin} min · {activity.category}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.doneBtn, done && styles.doneBtnDone]}
                    onPress={() => handleActivityDone(activity)}
                    disabled={done}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.doneBtnText}>{done ? '✓' : 'I did it'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>

        {/* Privacy footer */}
        <Text style={styles.privacyFooter}>
          All data stays on your device. Nothing is sent anywhere.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekText: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },
  gearBtn: { padding: 4 },
  gearIcon: { fontSize: 20, color: colors.textSecondary },
  observerBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  observerTitle: { color: colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  observerBody: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20 },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  streakNumber: { fontSize: 48, fontWeight: '800', color: colors.accent },
  streakLabel: { fontSize: font.md, color: colors.textSecondary, marginTop: 4 },
  streakBest: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary },
  sectionToggle: { color: colors.textSecondary, fontSize: font.md },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  totalTime: { fontSize: font.xxl, fontWeight: '800', color: colors.textPrimary },
  delta: { fontSize: font.sm, fontWeight: '600' },
  deltaUp: { color: colors.danger },
  deltaDown: { color: colors.success },
  emptyMsg: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.sm },
  appRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appInfo: { flex: 1 },
  appName: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  appTime: { fontSize: font.sm, color: colors.accent, marginTop: 2 },
  appYest: { fontSize: font.xs, color: colors.textSecondary },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityDone: { opacity: 0.5 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: font.md, color: colors.textPrimary, fontWeight: '500' },
  activityLabelDone: { textDecorationLine: 'line-through' },
  activityMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  doneBtnDone: { backgroundColor: colors.success },
  doneBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  privacyFooter: {
    color: colors.textSecondary,
    fontSize: font.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
