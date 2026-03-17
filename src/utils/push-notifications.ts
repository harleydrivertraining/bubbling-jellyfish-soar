"use client";

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const initializePushNotifications = async (userId: string) => {
  // Push notifications only work on native platforms (iOS/Android)
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms.');
    return;
  }

  // 1. Request permission
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.warn('User denied push notification permissions.');
    return;
  }

  // 2. Register with Apple/Google to get a token
  await PushNotifications.register();

  // 3. Listen for successful registration and save the token to Supabase
  PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token: ' + token.value);
    
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        token: token.value,
        platform: Capacitor.getPlatform()
      }, { onConflict: 'user_id, token' });

    if (error) {
      console.error('Error saving push token to database:', error);
    }
  });

  // 4. Handle errors
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on push registration: ' + JSON.stringify(error));
  });

  // 5. Handle incoming notifications while the app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
  });
};