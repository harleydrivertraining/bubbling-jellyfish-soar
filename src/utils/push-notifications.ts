"use client";

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const initializePushNotifications = async (userId: string) => {
  // Push notifications only work on native platforms (iOS/Android)
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Check current permission status
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permissions.');
      return;
    }

    // 2. Add listeners BEFORE registering to catch the token
    // We wrap these in try-catch to prevent native errors from bubbling up
    
    await PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success');
      
      try {
        const { error } = await supabase
          .from('user_push_tokens')
          .upsert({
            user_id: userId,
            token: token.value,
            platform: Capacitor.getPlatform()
          }, { onConflict: 'user_id, token' });

        if (error) console.error('Error saving push token:', error);
      } catch (e) {
        console.error('Supabase error during token save:', e);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', JSON.stringify(error));
    });

    // 3. Register with a small delay to ensure the native bridge is fully ready
    // This helps prevent boot-time crashes
    setTimeout(async () => {
      try {
        await PushNotifications.register();
      } catch (e) {
        console.error('Native registration call failed:', e);
      }
    }, 1000);

  } catch (globalError) {
    console.error('Global push notification init error:', globalError);
  }
};