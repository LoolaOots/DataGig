import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(30).optional().nullable(),
  age: z.number().int().min(13).max(120).optional().nullable(),
  stateCountry: z.string().max(100).optional().nullable(),
  // Company fields
  companyName: z.string().min(1).max(200).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = userRow?.role ?? "user";
  const admin = createAdminClient();

  if (role === "company") {
    const { companyName, websiteUrl, description } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (companyName !== undefined) updates.company_name = companyName;
    if (websiteUrl !== undefined) updates.website_url = websiteUrl;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await admin.from("company_profiles").update(updates).eq("user_id", user.id);
    }
  } else {
    const { displayName, bio, phone, age, stateCountry } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (stateCountry !== undefined) updates.state_country = stateCountry;

    if (Object.keys(updates).length > 0) {
      await admin.from("user_profiles").update(updates).eq("user_id", user.id);
    }
  }

  return NextResponse.json({ success: true });
}
