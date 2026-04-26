"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface Submission {
  id: string;
  storagePath: string;
  durationSeconds: number | null;
  submittedAt: string;
  labelName: string | null;
  submitterName: string | null;
  submitterEmail: string;
}

interface Props {
  submissions: Submission[];
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function filename(storagePath: string): string {
  return storagePath.split("/").pop() ?? storagePath;
}

export default function RecordingsClient({ submissions }: Props) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [isZipping, setIsZipping] = useState(false);

  // Derive labels (non-null only, sorted alphabetically)
  const labels = useMemo(
    () =>
      Array.from(
        new Set(
          submissions
            .filter((s) => s.labelName !== null)
            .map((s) => s.labelName as string)
        )
      ).sort(),
    [submissions]
  );

  // Label counts (total for all, not just visible)
  const labelCounts = useMemo(
    () =>
      Object.fromEntries(
        labels.map((label) => [
          label,
          submissions.filter((s) => s.labelName === label).length,
        ])
      ),
    [submissions, labels]
  );

  // Visible submissions based on active tab
  const visible = useMemo(
    () =>
      activeTab === "all"
        ? submissions
        : submissions.filter((s) => s.labelName === activeTab),
    [submissions, activeTab]
  );

  // Selection state relative to visible list
  const allVisibleSelected =
    visible.length > 0 && visible.every((s) => selectedIds.has(s.id));
  const someVisibleSelected =
    visible.some((s) => selectedIds.has(s.id)) && !allVisibleSelected;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  // Total selected across all tabs
  const totalSelected = selectedIds.size;

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visible.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visible.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const downloadSingle = async (submissionId: string) => {
    // Clear previous error
    setDownloadErrors((prev) => {
      const next = { ...prev };
      delete next[submissionId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/company/recordings/signed-url?submissionId=${submissionId}`
      );
      if (!res.ok) throw new Error("failed");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch {
      setDownloadErrors((prev) => ({ ...prev, [submissionId]: "Failed — try again" }));
    }
  };

  const downloadZip = async () => {
    if (totalSelected === 0 || totalSelected > 100 || isZipping) return;
    setIsZipping(true);
    try {
      const res = await fetch("/api/company/recordings/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: [...selectedIds] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Download failed — please try again");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const dlFilename = match ? match[1] : "recordings.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dlFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed — please try again");
    } finally {
      setIsZipping(false);
    }
  };

  if (submissions.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-center text-gray-500">
        <p>No recordings yet for this gig.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl">
      {/* Label filter tabs */}
      <div className="border-b bg-white px-6 flex gap-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "all"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          All ({submissions.length})
        </button>
        {labels.map((label) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === label
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label} ({labelCounts[label]})
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      <div className="sticky top-0 z-10 border-b bg-gray-50 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={allVisibleSelected}
            ref={selectAllRef}
            onChange={toggleSelectAll}
          />
          <span className="text-sm text-gray-500">Select all ({visible.length})</span>
          {totalSelected > 0 && (
            <>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm font-medium text-blue-600">
                {totalSelected} selected
              </span>
            </>
          )}
        </div>
        {totalSelected > 0 && (
          <div className="flex items-center gap-2">
            {totalSelected > 100 && (
              <span className="text-xs text-red-500">Select 100 or fewer files</span>
            )}
            <button
              onClick={downloadZip}
              disabled={totalSelected > 100 || isZipping}
              title={totalSelected > 100 ? "Select 100 or fewer files" : undefined}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isZipping ? "Zipping…" : `↓ Download selected (${totalSelected})`}
            </button>
          </div>
        )}
      </div>

      {/* File list */}
      <div className="bg-white">
        {/* Header row */}
        <div className="grid px-6 py-2 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500"
          style={{ gridTemplateColumns: "2rem 1fr 6rem 7rem 5rem" }}>
          <span />
          <span>File</span>
          <span>Duration</span>
          <span>Submitted</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">
            No recordings for this label.
          </div>
        ) : (
          visible.map((s) => (
            <div
              key={s.id}
              className={`grid items-center gap-2 px-6 py-2.5 border-b border-gray-50 transition ${
                selectedIds.has(s.id) ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
              style={{ gridTemplateColumns: "2rem 1fr 6rem 7rem 5rem" }}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleRow(s.id)}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {filename(s.storagePath)}
                </p>
                <p className="text-xs text-gray-500">{s.labelName ?? "—"}</p>
                <p className="truncate text-xs text-gray-400">
                  {s.submitterName ?? s.submitterEmail}
                </p>
              </div>
              <span className="text-sm text-gray-700">
                {formatDuration(s.durationSeconds)}
              </span>
              <span className="text-sm text-gray-700">
                {formatRelativeTime(new Date(s.submittedAt))}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => downloadSingle(s.id)}
                  title="Download"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {downloadErrors[s.id] && (
                  <span className="text-xs text-red-500">{downloadErrors[s.id]}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
