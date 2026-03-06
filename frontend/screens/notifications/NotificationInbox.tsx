/**
 * NotificationInbox
 *
 * Full-screen list of in-app notifications. Each item shows the notification
 * title, body, timestamp, and an optional Ojo personality badge.
 * Supports pull-to-refresh, cursor-based pagination, swipe-to-delete,
 * and a "mark all read" action in the header.
 *
 * Rendered when `activeTab === "notifications"` in MainLayout.
 */
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from "react-native";
import { COLORS, FONTS, FONT_SIZES, SPACING } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { useNavigation } from "../../context/NavigationContext";
import { useNotifications } from "../../context/NotificationContext";
import { ICONS } from "../../components/icons/icons";
import { getOjoType, getOjoTypeColor, type OjoTypeName } from "../../config/ojoTypeConfig";
import ScrollableContent from "../../components/layout/ScrollableContent";
import AppText from "../../components/common/AppText";
import {
  getInboxNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type InAppNotification,
} from "../../services/notificationService";

// ── Helpers ────────────────────────────────────────────────────────────

/** Friendly relative timestamp (e.g. "3m ago", "2h ago", "Yesterday") */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Icon component to show for a notification type */
function notificationIcon(type: string, ojoType: OjoTypeName | null, color: string) {
  if (ojoType) {
    const cfg = getOjoType(ojoType);
    const OjoIcon = ICONS[cfg.icon as keyof typeof ICONS];
    if (OjoIcon) return <OjoIcon size={28} color={getOjoTypeColor(ojoType)} />;
  }

  switch (type) {
    case "morning_digest":
      return ICONS.sun ? <ICONS.sun size={28} color={color} /> : <ICONS.calendar size={28} color={color} />;
    case "task_reminder":
      return <ICONS.notifications size={28} color={color} />;
    default:
      return <ICONS.notifications size={28} color={color} />;
  }
}

// ── Component ──────────────────────────────────────────────────────────

export default function NotificationInbox() {
  const colors = useColors();
  const { setHeaderConfig, goBack } = useNavigation();
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ── Header config ──────────────────────────────────────────────────
  useEffect(() => {
    const BackIcon = ICONS.left;
    setHeaderConfig({
      show: true,
      title: "Notifications",
      leftElement: BackIcon ? (
        <TouchableOpacity onPress={goBack} style={{ padding: SPACING.sm }}>
          <BackIcon size={22} color={COLORS.primary1} />
        </TouchableOpacity>
      ) : undefined,
      rightElement: (
        <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: SPACING.sm }}>
          <AppText variant="bodyText" style={{ color: COLORS.primary1 }}>
            Mark all read
          </AppText>
        </TouchableOpacity>
      ),
    });
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    const result = await getInboxNotifications({ limit: 30 });
    if (result.success) {
      setNotifications(result.notifications);
      setHasMore(result.notifications.length >= 30);
    }
    setLoading(false);
    refreshUnreadCount();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || notifications.length === 0) return;
    setLoadingMore(true);
    const last = notifications[notifications.length - 1];
    const result = await getInboxNotifications({ limit: 30, before: last.createdAt });
    if (result.success) {
      setNotifications((prev) => [...prev, ...result.notifications]);
      setHasMore(result.notifications.length >= 30);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, notifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(false);
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    refreshUnreadCount();
  }, []);

  const handleTap = useCallback(
    async (item: InAppNotification) => {
      if (!item.read) {
        markNotificationRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)),
        );
        refreshUnreadCount();
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      refreshUnreadCount();
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: InAppNotification }) => (
      <NotificationRow
        item={item}
        colors={colors}
        onTap={handleTap}
        onDelete={handleDelete}
      />
    ),
    [colors, handleTap, handleDelete],
  );

  const keyExtractor = useCallback((item: InAppNotification) => item._id, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg3 }]}>
        <ActivityIndicator size="large" color={COLORS.primary1} />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <ScrollableContent respectHeader respectNavBar>
        <View style={[styles.emptyContainer]}>
          <ICONS.notifications size={48} color={colors.gray1} />
          <AppText variant="bodyText" style={{ color: colors.gray1, marginTop: SPACING.md }}>
            No notifications yet
          </AppText>
        </View>
      </ScrollableContent>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg3 }]}>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary1} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={COLORS.primary1} style={{ marginVertical: SPACING.md }} />
          ) : null
        }
      />
    </View>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────

type RowProps = {
  item: InAppNotification;
  colors: any;
  onTap: (item: InAppNotification) => void;
  onDelete: (id: string) => void;
};

function NotificationRow({ item, colors, onTap, onDelete }: RowProps) {
  const accentColor = item.ojoType ? getOjoTypeColor(item.ojoType as OjoTypeName) : COLORS.primary1;
  const isUnread = !item.read;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onTap(item)}
      onLongPress={() => onDelete(item._id)}
      style={[
        styles.row,
        { backgroundColor: colors.bg2, shadowColor: colors.shadow },
        isUnread && styles.rowUnread,
      ]}
    >
      {/* Colored accent bar on the left */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Ojo icon with colored circle */}
      <View style={[styles.iconCircle, { backgroundColor: accentColor + "20" }]}>
        {notificationIcon(item.type, item.ojoType as OjoTypeName | null, accentColor)}
      </View>

      {/* Text content */}
      <View style={styles.textArea}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: colors.text1, fontFamily: isUnread ? FONTS.fredokaSemiBold : FONTS.fredokaMedium },
            ]}
          >
            {item.title}
          </Text>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />}
        </View>
        {!!item.body && (
          <Text numberOfLines={2} style={[styles.body, { color: colors.gray1 }]}>
            {item.body}
          </Text>
        )}
        <Text style={[styles.time, { color: colors.gray1 }]}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
  },
  listContent: {
    paddingTop: 100, // leave room for floating header
    paddingBottom: 120, // leave room for floating navbar
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: SPACING.md,
    gap: SPACING.md,
    overflow: "hidden",
    // Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  rowUnread: {
    shadowOpacity: 0.3,
    elevation: 10,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  textArea: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  time: {
    fontSize: FONT_SIZES.sm * 0.85,
    fontFamily: FONTS.fredokaRegular,
    marginTop: 2,
    opacity: 0.7,
  },
  body: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
