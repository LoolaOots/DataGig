import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (userRow as unknown as { role: string } | null)?.role ?? "user";

  let profileData: Record<string, unknown> = {};

  if (role === "company") {
    const { data } = await supabase
      .from("company_profiles")
      .select("company_name, website_url, description")
      .eq("user_id", user.id)
      .single();
    profileData = (data as unknown as Record<string, unknown>) ?? {};
  } else {
    const { data } = await supabase
      .from("user_profiles")
      .select("display_name, bio, phone, age, state_country")
      .eq("user_id", user.id)
      .single();
    profileData = (data as unknown as Record<string, unknown>) ?? {};
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mb-8 text-sm text-gray-500">Manage your account information.</p>

        <SettingsForm
          email={user.email ?? ""}
          role={role}
          initialData={profileData}
        />
      </main>
    </div>
  );
}
