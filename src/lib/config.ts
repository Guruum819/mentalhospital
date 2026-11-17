import type { FirebaseOptions } from 'firebase/app'

export type FirebasePublicConfig = Required<
  Pick<FirebaseOptions, 'apiKey' | 'authDomain' | 'databaseURL' | 'projectId' | 'appId'>
>

const FIELDS = [
  ['VITE_FIREBASE_API_KEY', 'apiKey'],
  ['VITE_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['VITE_FIREBASE_DATABASE_URL', 'databaseURL'],
  ['VITE_FIREBASE_PROJECT_ID', 'projectId'],
  ['VITE_FIREBASE_APP_ID', 'appId'],
] as const

export function readFirebaseConfig(): FirebasePublicConfig | null {
  const config = {} as FirebasePublicConfig
  for (const [envName, key] of FIELDS) {
    const value = import.meta.env[envName]?.trim()
    if (!value) return null
    config[key] = value
  }
  return config
}

export function emulatorAddress(): { host: string; port: number } | null {
  const raw = import.meta.env.VITE_FIREBASE_EMULATOR?.trim()
  if (!raw) return null
  const [host, portText] = raw.split(':')
  const port = Number(portText)
  if (!host || !Number.isInteger(port)) return null
  return { host, port }
}
