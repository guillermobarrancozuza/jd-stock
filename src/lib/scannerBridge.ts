import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase.ts';

const DEVICE_ID_STORAGE_KEY = 'jd_scanner_device_id';

export interface ScannerBridgeDoc {
  userId: string;
  lastCode?: string;
  scanId?: string;
  scannedAt?: number;
  senderDeviceId: string;
  senderName?: string;
  mobileActiveAt?: number;
  updatedAt: string;
}

export function getLocalDeviceId(): string {
  try {
    const existing = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
      return existing;
    }
    const generated = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function getRemoteScannerUrl(): string {
  if (typeof window === 'undefined') return '/?scanner=remote';
  return `${window.location.origin}/?scanner=remote`;
}

export function isRemoteScannerModeFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('scanner') === 'remote' || params.get('mode') === 'scanner';
}

export async function sendMobileScannerHeartbeat(params: {
  userId: string;
  senderName?: string;
}): Promise<void> {
  const { userId, senderName } = params;
  if (!userId) return;
  const now = Date.now();
  const payload: ScannerBridgeDoc = {
    userId: userId.slice(0, 128),
    senderDeviceId: getLocalDeviceId().slice(0, 128),
    senderName: (senderName || 'Escáner Móvil').slice(0, 120),
    mobileActiveAt: now,
    updatedAt: new Date(now).toISOString(),
  };

  await setDoc(doc(db, 'scanner_bridge', userId), payload, { merge: true });
}

export async function publishRemoteQrScan(params: {
  userId: string;
  senderName?: string;
  code: string;
}): Promise<{ scanId: string; scannedAt: number }> {
  const { userId, senderName, code } = params;
  const cleanCode = code.trim().slice(0, 500);
  const now = Date.now();
  const scanId = `scan_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const payload: ScannerBridgeDoc = {
    userId: userId.slice(0, 128),
    lastCode: cleanCode,
    scanId,
    scannedAt: now,
    senderDeviceId: getLocalDeviceId().slice(0, 128),
    senderName: (senderName || 'Escáner Móvil').slice(0, 120),
    mobileActiveAt: now,
    updatedAt: new Date(now).toISOString(),
  };

  await setDoc(doc(db, 'scanner_bridge', userId), payload, { merge: true });
  return { scanId, scannedAt: now };
}
