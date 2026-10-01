"use client";

import { formatFileSize, type MediaUploadState } from "@/lib/supabase/upload-with-progress";

const statusLabels: Record<MediaUploadState["status"], string> = {
  preparing: "Preparing",
  uploading: "Uploading",
  saving: "Saving",
  complete: "Complete",
  error: "Error",
  cancelled: "Cancelled",
};

export default function MediaUploadProgress({
  upload,
  onCancel,
  onRetry,
}: {
  upload: MediaUploadState;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  const canCancel = upload.status === "preparing" || upload.status === "uploading";
  const canRetry = upload.status === "error" || upload.status === "cancelled";
  const timeRemaining = upload.secondsRemaining === null
    ? "Calculating..."
    : `${upload.secondsRemaining}s remaining`;

  return (
    <section aria-live="polite" className="rounded-xl border border-slate-600 bg-slate-900 p-4 text-sm text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">{statusLabels[upload.status]}: <span className="break-all text-slate-200">{upload.fileName}</span></p>
        {upload.totalBytes > 0 && <p className="font-semibold tabular-nums text-sky-300">{upload.percent}%</p>}
      </div>
      {upload.totalBytes > 0 && (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700"
            role="progressbar"
            aria-label="Media upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={upload.percent}
          >
            <div className="h-full rounded-full bg-sky-400 transition-[width] duration-150" style={{ width: `${upload.percent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
            <span>{formatFileSize(upload.uploadedBytes)} / {formatFileSize(upload.totalBytes)}</span>
            {upload.status === "uploading" && (
              <>
                <span>{formatFileSize(upload.bytesPerSecond)}/s</span>
                <span>{timeRemaining}</span>
              </>
            )}
          </div>
        </>
      )}
      {upload.status === "saving" && <p className="mt-2 text-xs text-slate-300">Upload finished. Saving media details…</p>}
      {upload.status === "complete" && <p className="mt-2 text-xs font-semibold text-emerald-300">Media saved successfully.</p>}
      {upload.error && <p role="alert" className="mt-2 text-xs font-semibold text-red-300">{upload.error}</p>}
      {(canCancel || canRetry) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canCancel && onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-red-400 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">Cancel Upload</button>}
          {canRetry && onRetry && <button type="button" onClick={onRetry} className="rounded-lg border border-sky-400 bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">Retry Upload</button>}
        </div>
      )}
    </section>
  );
}
