import { useState, type DragEvent, type ChangeEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { formatBytes, cn } from "@/lib/utils";

type FileDropzoneProps = {
  id?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  hint?: string;
  error?: string;
  disabled?: boolean;
};

const DEFAULT_ACCEPT = ".csv,.xlsx,.xls";
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export function FileDropzone({
  id = "file-dropzone",
  file,
  onFile,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX_BYTES,
  hint = "CSV or Excel · up to 10 MB",
  error,
  disabled = false,
}: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");

  const allowed = accept.split(",").map((ext) => ext.trim().toLowerCase());
  const displayError = error || localError;

  function validate(next: File): string | null {
    const name = next.name.toLowerCase();
    const okType = allowed.some((ext) => name.endsWith(ext.replace(/^\*/, "")));
    if (!okType) return `Use a ${allowed.join(", ")} file`;
    if (next.size > maxBytes) return `File is too large. Max ${formatBytes(maxBytes)}.`;
    return null;
  }

  function apply(next: File | null) {
    setLocalError("");
    if (!next) {
      onFile(null);
      return;
    }
    const problem = validate(next);
    if (problem) {
      setLocalError(problem);
      onFile(null);
      return;
    }
    onFile(next);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const next = e.dataTransfer.files?.[0] ?? null;
    apply(next);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    apply(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-accent bg-accent-muted/40"
            : "border-border-default bg-bg-elevated/40 hover:border-accent/50 hover:bg-bg-elevated",
          disabled && "pointer-events-none opacity-50",
          displayError && "border-danger/50",
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={handleChange}
        />
        {file ? (
          <div className="flex max-w-full items-center gap-3">
            <FileSpreadsheet className="icon-lg text-accent" strokeWidth={2} aria-hidden />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
              <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-text-primary"
              aria-label="Remove file"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                apply(null);
              }}
            >
              <X className="icon-sm" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <Upload className="icon-lg text-accent" strokeWidth={2} aria-hidden />
            <p className="mt-2 text-sm font-medium text-text-primary">Drop a file here, or browse</p>
            <p className="mt-1 text-xs text-text-muted">{hint}</p>
          </>
        )}
      </label>
      {displayError ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
