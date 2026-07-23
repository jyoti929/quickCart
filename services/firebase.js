import Constants from "expo-constants";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const fallbackConfig = {
  apiKey: "AIzaSyDhQ166kRf-WO4xclX-NvSy2j8dtEyMCTw",
  authDomain: "quickcart-shared.firebaseapp.com",
  projectId: "quickcart-shared",
  storageBucket: "quickcart-shared.firebasestorage.app",
  messagingSenderId: "221503732530",
  appId: "1:221503732530:web:f7e20e123bec7f36ceb52b",
  measurementId: "G-ES1M12WKE6",
};

function extraValue(key) {
  return Constants.expoConfig?.extra?.firebase?.[key] || "";
}

function configValue(publicEnvValue, key) {
  return publicEnvValue || extraValue(key) || fallbackConfig[key];
}

const firebaseConfig = {
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
