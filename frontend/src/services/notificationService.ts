import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Show alerts while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForLocalNotificationsAsync(): Promise<boolean> {
  if (!Device.isDevice) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (e) {
    console.warn('Failed to get/ask notification permissions:', e);
    return false;
  }
}

export async function scheduleLocalNotification({
  title,
  body,
  seconds = 1,
  data = {},
}: {
  title: string;
  body: string;
  seconds?: number;
  data?: Record<string, any>;
}) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      // some Expo versions have differing TS defs for trigger; cast to any to avoid mismatch
      trigger: { seconds, repeats: false } as any,
    });
    return id;
  } catch (e) {
    console.warn('Failed to schedule local notification:', e);
    throw e;
  }
}

export async function cancelAllLocalNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Failed to cancel local notifications:', e);
  }
}

export async function presentImmediateNotification({ title, body, data = {} }: { title: string; body: string; data?: Record<string, any> }) {
  // schedule with 0-1 second delay to present immediately
  return scheduleLocalNotification({ title, body, seconds: 1, data });
}

export default {
  registerForLocalNotificationsAsync,
  scheduleLocalNotification,
  cancelAllLocalNotifications,
  presentImmediateNotification,
};
