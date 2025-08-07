// src/lib/notifications.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  // Register for push notifications
  async registerForPushNotifications() {
    let token;

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
    }

    return token;
  },

  // Schedule local notification
  async scheduleLocalNotification(title, body, trigger) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'daily_reminder' },
      },
      trigger,
    });

    return id;
  },

  // Schedule daily learning reminders
  async scheduleDailyReminders() {
    // Cancel existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule daily reminder at 9 AM
    await this.scheduleLocalNotification(
      '📚 VocabVoyager Daily Learning',
      "Ready to learn 3 new words today? Let's keep your streak going!",
      {
        hour: 9,
        minute: 0,
        repeats: true,
      }
    );

    // Schedule evening review reminder at 7 PM
    await this.scheduleLocalNotification(
      '🧠 Time for Word Review',
      'Review your learned words to strengthen your memory!',
      {
        hour: 19,
        minute: 0,
        repeats: true,
      }
    );
  },

  // Handle notification responses
  addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  // Handle foreground notifications
  addNotificationListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }
};