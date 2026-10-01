import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaUploadStatus =
  | "preparing"
  | "uploading"
  | "saving"
  | "complete"
  | "error"
  | "cancelled";

export type MediaUploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number;
  secondsRemaining: number | null;
};

export type MediaUploadState = MediaUploadProgress & {
  status: MediaUploadStatus;
  fileName: string;
  error?: string;
};

export function initialMediaUploadState(file: File, status: MediaUploadStatus = "preparing"): MediaUploadState {
  return {
    status,
    fileName: file.name,
    uploadedBytes: 0,
    totalBytes: file.size,
    percent: 0,
    bytesPerSecond: 0,
    secondsRemaining: null,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The upload failed unexpectedly.";
}

export async function uploadFileWithProgress({
  client,
  bucket,
  path,
  file,
  signal,
  onProgress,
}: {
  client: SupabaseClient;
  bucket: string;
  path: string;
  file: File;
  signal: AbortSignal;
  onProgress: (progress: MediaUploadProgress) => void;
}): Promise<void> {
  if (signal.aborted) throw new DOMException("Upload cancelled.", "AbortError");

  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`Unable to prepare upload authentication: ${sessionError.message}`);
  if (!session?.access_token) throw new Error("Your session has expired. Sign in again before uploading media.");
  if (signal.aborted) throw new DOMException("Upload cancelled.", "AbortError");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Supabase Storage is not configured for browser uploads.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startedAt = performance.now();
    const storagePath = path.split("/").map(encodeURIComponent).join("/");
    const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath}`;
    let settled = false;

    const cleanup = () => signal.removeEventListener("abort", abortRequest);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const abortRequest = () => {
      xhr.abort();
      finish(new DOMException("Upload cancelled.", "AbortError"));
    };

    xhr.open("POST", endpoint);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      const uploadedBytes = Math.min(event.loaded, file.size);
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const bytesPerSecond = uploadedBytes / elapsedSeconds;
      onProgress({
        uploadedBytes,
        totalBytes: file.size,
        percent: file.size === 0 ? 100 : Math.min(100, Math.floor((uploadedBytes / file.size) * 100)),
        bytesPerSecond,
        secondsRemaining: bytesPerSecond > 0
          ? Math.max(0, Math.ceil((file.size - uploadedBytes) / bytesPerSecond))
          : null,
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
        const bytesPerSecond = file.size / elapsedSeconds;
        onProgress({
          uploadedBytes: file.size,
          totalBytes: file.size,
          percent: 100,
          bytesPerSecond,
          secondsRemaining: 0,
        });
        finish();
        return;
      }
      let message = `Storage upload failed with status ${xhr.status}.`;
      try {
        const response = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = response.message || response.error || message;
      } catch {
        if (xhr.responseText) message = xhr.responseText;
      }
      finish(new Error(message));
    };
    xhr.onerror = () => finish(new Error("A network error interrupted the media upload."));
    xhr.ontimeout = () => finish(new Error("The media upload timed out. Try again."));
    signal.addEventListener("abort", abortRequest, { once: true });
    if (signal.aborted) {
      abortRequest();
      return;
    }
    xhr.send(file);
  });
}
