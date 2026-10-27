import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';

/** Version installée (celle des stores), « 1.0.0 ». */
export function versionInstallee(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

/** Ce que l'app dit d'elle au planning, visible dans « App mobile » de l'admin. */
export function infosAppareil() {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : '',
    deviceName: Device.deviceName ?? '',
    model: Device.modelName ?? '',
    osVersion: Device.osVersion ?? '',
    appVersion: versionInstallee(),
    buildNumber: Application.nativeBuildVersion ?? '',
    updateId: Updates.isEnabled ? Updates.updateId ?? '' : '',
  };
}
