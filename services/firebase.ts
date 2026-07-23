import Constants from "expo-constants";
import { FirebaseOptions, initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore getReactNativePersistence is available at runtime for React Native.
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type FirebaseConfigKey = keyof FirebaseOptions;

const fallbackConfig: FirebaseOptions = {
  apiKey: "AIzaSyDhQ166kRf-WO4xclX-NvSy2j8dtEyMCTw",
  authDomain: "quickcart-shared.firebaseapp.com",
  projectId: "quickcart-shared",
  storageBucket: "quickcart-shared.firebasestorage.app",
  messagingSenderId: "221503732530",
  appId: "1:221503732530:web:f7e20e123bec7f36ceb52b",
  measurementId: "G-ES1M12WKE6",
};

function extraValue(key: FirebaseConfigKey) {
  return (Constants.expoConfig?.extra?.firebase?.[key] as string | undefined) || "";
}

function configValue(publicEnvValue: string | undefined, key: FirebaseConfigKey) {
  return publicEnvValue || extraValue(key) || fallbackConfig[key];
}

const firebaseConfig: FirebaseOptions = {
  apiKey: configValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "apiKey"),
  authDomain: configValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "authDomain"),
  projectId: configValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "projectId"),
  storageBucket: configValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, "storageBucket"),
  messagingSenderId: configValue(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "messagingSenderId"),
  appId: configValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "appId"),
  measurementId: configValue(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID, "measurementId"),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);

const persistence = Platform.OS === "web"
  ? browserLocalPersistence
  : getReactNativePersistence(AsyncStorage);

export const auth = (() => {
  try {
    return initializeAuth(app, { persistence });
  } catch {
    return getAuth(app);
  }
})();
