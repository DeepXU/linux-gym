export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

const env = (import.meta as any).env || {};

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'local-research-harness',
  appId: env.VITE_FIREBASE_APP_ID || 'local-app-id',
  apiKey: env.VITE_FIREBASE_API_KEY || 'local-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''
};

export default firebaseConfig;
