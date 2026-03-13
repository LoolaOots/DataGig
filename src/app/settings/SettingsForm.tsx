"use client";

import { useState } from "react";

interface Props {
  email: string;
  role: string;
  initialData: Record<string, unknown>;
}

export default function SettingsForm({ email, role, initialData }: Props) {
  const isCompany = role === "company";

  const [displayName, setDisplayName] = useState(
    (initialData.display_name as string) ?? ""
  );
  const [bio, setBio] = useState((initialData.bio as string) ?? "");
  const [phone, setPhone] = useState((initialData.phone as string) ?? "");
  const [age, setAge] = useState(
    initialData.age != null ? String(initialData.age) : ""
  );
  const [stateCountry, setStateCountry] = useState(
    (initialData.state_country as string) ?? ""
  );

  // Company fields
  const [companyName, setCompanyName] = useState(
    (initialData.company_name as string) ?? ""
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    (initialData.website_url as string) ?? ""
  );
  const [description, setDescription] = useState(
    (initialData.description as string) ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const body: Record<string, unknown> = isCompany
      ? {
          companyName: companyName || undefined,
          websiteUrl: websiteUrl || undefined,
          description: description || undefined,
        }
      : {
          displayName: displayName || undefined,
          bio: bio || undefined,
          phone: phone || null,
          age: age ? parseInt(age, 10) : null,
          stateCountry: stateCountry || null,
        };

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ? JSON.stringify(data.error) : "Failed to save.");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email — read-only */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Account</h2>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400">
            Email cannot be changed here.
          </p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">
          {isCompany ? "Company Profile" : "Profile"}
        </h2>
        <div className="space-y-4">
          {isCompany ? (
            <>
              <div>
                <label className={labelCls}>Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputCls}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className={labelCls}>Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={inputCls}
                  placeholder="Tell applicants about your company..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className={labelCls}>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className={inputCls}
                  placeholder="A short bio..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    Phone{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                    placeholder="+1 555 000 0000"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Age{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={13}
                    max={120}
                    className={inputCls}
                    placeholder="25"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  State / Country{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={stateCountry}
                  onChange={(e) => setStateCountry(e.target.value)}
                  className={inputCls}
                  placeholder="California, USA"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Saved successfully.</span>
        )}
      </div>
    </form>
  );
}
