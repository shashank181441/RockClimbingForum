const STORAGE_KEY = 'nepal-climbs:pending-uploads';

export interface PendingUpload {
  storage_path: string;
  file_url: string;
  file_type: string | null;
}

export function getPendingUploads(): PendingUpload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setPendingUploads(uploads: PendingUpload[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
}

export function addPendingUpload(upload: PendingUpload) {
  const existing = getPendingUploads();
  if (existing.some((u) => u.storage_path === upload.storage_path)) return;
  setPendingUploads([...existing, upload]);
}

export function removePendingUpload(storagePath: string) {
  setPendingUploads(getPendingUploads().filter((u) => u.storage_path !== storagePath));
}

export function clearPendingUploads(paths?: string[]) {
  if (!paths) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const remaining = getPendingUploads().filter((u) => !paths.includes(u.storage_path));
  if (remaining.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    setPendingUploads(remaining);
  }
}
