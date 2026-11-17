import type { FirebaseOptions } from 'firebase/app'

export type FirebasePublicConfig = Required<
  Pick<
    FirebaseOptions,
    | 'apiKey'
    | 'authDomain'
    | 'databaseURL'
    | 'projectId'
    | 'appId'
    | 'storageBucket'
    | 'messagingSenderId'
  >
>

/** Public web config. Visible in the page bundle; Realtime Database rules are the access control. */
export const PUBLIC_FIREBASE_CONFIG: FirebasePublicConfig = {
  apiKey: 'AIzaSyC_dOaZkf6EvX_K2oha_d45Eq6OKpUKKnc',
  authDomain: 'mentalhospital.firebaseapp.com',
  databaseURL: 'https://mentalhospital-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mentalhospital',
  appId: '1:157804241076:web:e1471c055752d88708b7e1',
  storageBucket: 'mentalhospital.firebasestorage.app',
  messagingSenderId: '157804241076',
}

function envValue(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function readFirebaseConfig(): FirebasePublicConfig | null {
  const config: FirebasePublicConfig = {
    apiKey: envValue(import.meta.env.VITE_FIREBASE_API_KEY) || PUBLIC_FIREBASE_CONFIG.apiKey,
    authDomain: envValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || PUBLIC_FIREBASE_CONFIG.authDomain,
    databaseURL: envValue(import.meta.env.VITE_FIREBASE_DATABASE_URL) || PUBLIC_FIREBASE_CONFIG.databaseURL,
    projectId: envValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) || PUBLIC_FIREBASE_CONFIG.projectId,
    appId: envValue(import.meta.env.VITE_FIREBASE_APP_ID) || PUBLIC_FIREBASE_CONFIG.appId,
    storageBucket: PUBLIC_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: PUBLIC_FIREBASE_CONFIG.messagingSenderId,
  }
  if (!config.apiKey || !config.authDomain || !config.databaseURL || !config.projectId || !config.appId) {
    return null
  }
  return config
}

/** Public Kakao REST key. Env wins. It is visible in the page, like the Firebase web config. */
export const PUBLIC_KAKAO_REST_API_KEY = '5b6ec20ebe78afe95c933814ad0992b4'

export function readKakaoKey(): string {
  return envValue(import.meta.env.VITE_KAKAO_REST_API_KEY) || PUBLIC_KAKAO_REST_API_KEY
}

export function readGoogleBooksKey(): string {
  return envValue(import.meta.env.VITE_GOOGLE_BOOKS_API_KEY) || readFirebaseConfig()?.apiKey || ''
}

export function emulatorAddress(): { host: string; port: number } | null {
  const raw = import.meta.env.VITE_FIREBASE_EMULATOR?.trim()
  if (!raw) return null
  const [host, portText] = raw.split(':')
  const port = Number(portText)
  if (!host || !Number.isInteger(port)) return null
  return { host, port }
}
