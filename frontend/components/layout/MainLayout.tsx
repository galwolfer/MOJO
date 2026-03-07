import React, { useState, useCallback, useEffect, useRef } from "react";

/**
 * MainLayout
 *
 * Composes the app's primary visual chrome: floating `Header` and `NavBar`
 * with a central content area that renders the active screen. Handles
 * measuring header/navbar heights and adapting to keyboard visibility.
 */
import { View, StyleSheet, Platform, useWindowDimensions, LayoutChangeEvent } from "react-native";
import { useNavigation } from "../../context/NavigationContext";
import { useLayout } from "../../context/LayoutContext";
import Header from "../common/Header";
import NavBar from "../common/NavBar";
import ChatScreen from "../../screens/chat/Chat";
import CalendarScreen from "../../screens/calendar/Calendar";
import UserProfileScreen from "../../screens/user/UserProfile";
import CreateTaskScreen from "../../screens/createEditTasks/CreateTask";
import EditTaskScreen from "../../screens/createEditTasks/EditTask";
import OverdueTasksModal from "../../screens/OverdueTasks";
import AllTasksScreen from "../../screens/calendar/AllTasksScreen";
import NotificationInbox from "../../screens/notifications/NotificationInbox";
import { getOverdueTasks } from "../../services/taskService";
import { COLORS, SPACING } from "../../theme";
import { useKeyboard } from "../../hooks";
import { useColors } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { OjoNotificationBanner } from "../special/OjoNotificationBanner";

export default function MainLayout() {
  const { activeTab, headerConfig, navBarConfig, navigationParams, setActiveTab } = useNavigation();
  const { setHeaderHeight, setNavBarHeight } = useLayout();
  const colors = useColors();
  const { bannerData, dismissBanner } = useNotifications();
  const { width, height } = useWindowDimensions();
  const isDesktopLike = Platform.OS === "web" ? width >= 900 : width >= 900;
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const keyboardOffset = keyboardVisible ? keyboardHeight : 0;
  const hasNavWidget = Boolean(navBarConfig.widget);

  // Track actual measured heights of header and navbar
  const [localHeaderHeight, setLocalHeaderHeight] = useState(0);
  const [localNavBarHeight, setLocalNavBarHeight] = useState(0);

  // On mount: check for overdue tasks and show modal if any exist.
  // Using a ref to guarantee this runs only once even in StrictMode.
  const overdueChecked = useRef(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  useEffect(() => {
    if (overdueChecked.current) return;
    overdueChecked.current = true;
    getOverdueTasks().then((tasks) => {
      if (tasks.length > 0) {
        setShowOverdueModal(true);
      }
    });
  }, []);

  const onHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setLocalHeaderHeight(height);
      setHeaderHeight(height);
    },
    [setHeaderHeight],
  );

  const onNavBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setLocalNavBarHeight(height);
      // Effective height includes the bottom margin
      const effectiveHeight = height + SPACING.xlg;
      setNavBarHeight(height, effectiveHeight);
    },
    [setNavBarHeight],
  );

  const renderScreen = () => {
    switch (activeTab) {
      case "chat":
        return <ChatScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "user":
        return <UserProfileScreen />;
      case "create":
        return <CreateTaskScreen />;
      case "edit":
        return <EditTaskScreen taskId={navigationParams?.taskId || ""} />;
      case "alltasks":
        return <AllTasksScreen />;
      case "notifications":
        return <NotificationInbox />;
      default:
        return <ChatScreen />;
    }
  };

  // Calculate dynamic styles
  const deviceWidth = 700;
  const deviceHeight = Math.min(height, 1300);

  const outerStyle = isDesktopLike ? styles.desktopOuter : styles.container;
  const deviceStyle = isDesktopLike
    ? [styles.deviceFrame, { width: deviceWidth, height: deviceHeight }]
    : styles.deviceFull;

  return (
    <View style={outerStyle}>
      <View style={[deviceStyle, { backgroundColor: colors.bg3 }]}>
        {/* Main Content Area - Full screen */}
        <View style={styles.contentArea}>{renderScreen()}</View>

        {/* Overdue Tasks Modal – shown on top of chat on app open */}
        <OverdueTasksModal visible={showOverdueModal} onClose={() => setShowOverdueModal(false)} />

        {/* Floating Header */}
        <View style={styles.headerContainer} onLayout={onHeaderLayout}>
          <Header
            title={headerConfig.title}
            show={headerConfig.show}
            Icon={headerConfig.icon}
            leftElement={headerConfig.leftElement}
            rightElement={headerConfig.rightElement}
            element={headerConfig.element}
          />
        </View>

        {/* Floating NavBar */}
        <View
          style={[styles.navBarContainer, keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined]}
          onLayout={onNavBarLayout}
        >
          <NavBar hideIcons={keyboardVisible && hasNavWidget} />
        </View>

        {/* In-app notification banner — inside device frame so it respects the app bounds */}
        <OjoNotificationBanner data={bannerData} onDismiss={dismissBanner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  desktopOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceFrame: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
    position: "relative",
  },
  deviceFull: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  contentArea: {
    flex: 1,
    width: "100%",
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
