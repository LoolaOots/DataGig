"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Label fields are stored as strings for clean text input editing
interface LabelInput {
  labelName: string;
  description: string;
  durationSeconds: string;
  rateDollars: string;      // user types dollars, we convert to cents on submit
  quantityNeeded: string;
}

type DeviceType = "apple_watch" | "generic_android" | "generic_ios";

const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const inputSmCls = "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500";

function toISOOrUndefined(localDatetime: string): string | undefined {
  if (!localDatetime) return undefined;
  // datetime-local gives "YYYY-MM-DDTHH:MM", convert to full ISO
  return new Date(localDatetime).toISOString();
}

export default function NewGigPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState("");
  const [totalSlots, setTotalSlots] = useState("10");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [dataDeadline, setDataDeadline] = useState("");

  // Step 2: Labels
  const [labels, setLabels] = useState<LabelInput[]>([
    { labelName: "", description: "", durationSeconds: "30", rateDollars: "1.00", quantityNeeded: "10" },
  ]);

  // Step 3: Devices
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>(["generic_ios"]);

  const addLabel = () => {
    setLabels([...labels, { labelName: "", description: "", durationSeconds: "30", rateDollars: "1.00", quantityNeeded: "10" }]);
  };

  const updateLabel = (i: number, field: keyof LabelInput, value: string) => {
    const updated = [...labels];
    updated[i] = { ...updated[i], [field]: value };
    setLabels(updated);
  };

  const removeLabel = (i: number) => {
    setLabels(labels.filter((_, idx) => idx !== i));
  };

  const toggleDevice = (dt: DeviceType) => {
    if (deviceTypes.includes(dt)) {
      if (deviceTypes.length > 1) setDeviceTypes(deviceTypes.filter((d) => d !== dt));
    } else {
      setDeviceTypes([...deviceTypes, dt]);
    }
  };

  const totalEarnable = labels.reduce(
    (sum, l) => sum + (parseFloat(l.rateDollars) || 0) * (parseInt(l.quantityNeeded) || 0),
    0
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/gigs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        activityType,
        totalSlots: parseInt(totalSlots) || 1,
        applicationDeadline: toISOOrUndefined(applicationDeadline),
        dataDeadline: toISOOrUndefined(dataDeadline),
        labels: labels.map((l) => ({
          labelName: l.labelName,
          description: l.description,
          durationSeconds: parseInt(l.durationSeconds) || 1,
          rateCents: Math.round((parseFloat(l.rateDollars) || 0) * 100),
          quantityNeeded: parseInt(l.quantityNeeded) || 1,
        })),
        deviceTypes,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const text = await res.text();
      let data: { error?: unknown } = {};
      try { data = JSON.parse(text); } catch { /* non-JSON error body */ }
      if (typeof data.error === "object" && data.error !== null && "fieldErrors" in data.error) {
        const fieldErrors = (data.error as Record<string, Record<string, string[]>>).fieldErrors;
        const messages = Object.entries(fieldErrors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        setError(messages || "Validation failed — please check all required fields.");
      } else {
        setError(typeof data.error === "string" ? data.error : `Request failed (${res.status}). Please try again.`);
      }
      return;
    }

    const gig = await res.json();
    router.push(`/company/gigs/${gig.id}`);
  };

  const deviceLabels: Record<DeviceType, string> = {
    apple_watch: "Apple Watch",
    generic_android: "Android",
    generic_ios: "iPhone / iPad",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/company/gigs" className="text-gray-500 hover:text-gray-900">← Gigs</Link>
            <h1 className="font-semibold text-gray-900">Create New Gig</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/company/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/company/support" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Need help?
            </Link>
          </div>
        </div>
      </nav>

      {/* Step indicator */}
      <div className="border-b bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl gap-6">
          {["Basic Info", "Labels", "Devices & Review"].map((label, i) => (
            <button
              key={label}
              onClick={() => step > i + 1 && setStep(i + 1)}
              className={`text-sm font-medium ${
                step === i + 1 ? "text-blue-600" : step > i + 1 ? "text-gray-600" : "text-gray-400"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {step === 1 && (
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 text-lg">Basic Information</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Walking gait data collection"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what data collectors will be doing..."
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Activity Type *</label>
                <input
                  type="text"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  placeholder="walking, running, cycling..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Total Slots *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={totalSlots}
                  onChange={(e) => setTotalSlots(e.target.value.replace(/\D/g, ""))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Application Deadline</label>
                <input
                  type="datetime-local"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Data Deadline</label>
                <input
                  type="datetime-local"
                  value={dataDeadline}
                  onChange={(e) => setDataDeadline(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!title || !description || !activityType}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Labels →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-lg">Data Labels</h2>
                <button onClick={addLabel} className="text-sm text-blue-600 hover:underline">
                  + Add label
                </button>
              </div>

              <div className="space-y-4">
                {labels.map((label, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Label {i + 1}</p>
                      {labels.length > 1 && (
                        <button onClick={() => removeLabel(i)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Label name *</label>
                        <input
                          type="text"
                          value={label.labelName}
                          onChange={(e) => updateLabel(i, "labelName", e.target.value)}
                          placeholder="walk, run, trot..."
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                        <input
                          type="text"
                          value={label.description}
                          onChange={(e) => updateLabel(i, "description", e.target.value)}
                          placeholder="Optional details"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Duration (seconds) *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={label.durationSeconds}
                          onChange={(e) => updateLabel(i, "durationSeconds", e.target.value.replace(/\D/g, ""))}
                          placeholder="30"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Pay per submission ($) *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={label.rateDollars}
                          onChange={(e) => updateLabel(i, "rateDollars", e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="1.00"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Quantity needed *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={label.quantityNeeded}
                          onChange={(e) => updateLabel(i, "quantityNeeded", e.target.value.replace(/\D/g, ""))}
                          placeholder="10"
                          className={inputSmCls}
                        />
                      </div>
                      <div className="flex items-end">
                        <p className="text-sm text-gray-500">
                          Total: <span className="font-medium text-green-600">
                            ${((parseFloat(label.rateDollars) || 0) * (parseInt(label.quantityNeeded) || 0)).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-gray-600">
                  Total escrow required: <span className="font-semibold text-gray-900">${totalEarnable.toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={labels.some((l) => !l.labelName)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Devices →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">Accepted Devices</h2>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(deviceLabels) as [DeviceType, string][]).map(([dt, label]) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => toggleDevice(dt)}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      deviceTypes.includes(dt)
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">Summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Title</dt>
                  <dd className="font-medium text-gray-900">{title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Activity</dt>
                  <dd className="font-medium text-gray-900">{activityType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Slots</dt>
                  <dd className="font-medium text-gray-900">{totalSlots}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Labels</dt>
                  <dd className="font-medium text-gray-900">{labels.length}</dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="font-medium text-gray-700">Total Escrow Required</dt>
                  <dd className="font-semibold text-gray-900">${totalEarnable.toFixed(2)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-400">
                This amount will be held in escrow from your balance when you publish the gig.
              </p>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || deviceTypes.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Gig (Draft)"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
