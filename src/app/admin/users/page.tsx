import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface SearchParams {
  page?: string;
  role?: string;
  q?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page ?? "1");
  const role = sp.role ?? "";
  const q = sp.q ?? "";
  const limit = 25;

  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select(
      `id, email, role, created_at,
       user_profiles(display_name, credits_balance_cents),
       company_profiles(company_name, balance_cents)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (role) query = query.eq("role", role);
  if (q) query = query.ilike("email", `%${q}%`);

  const { data: users, count } = await query;

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">{count ?? 0} total</p>
      </div>

      {/* Filters */}
      <form className="mb-4 flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search email..."
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          name="role"
          defaultValue={role}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All roles</option>
          <option value="user">user</option>
          <option value="company">company</option>
          <option value="admin">admin</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Filter
        </button>
      </form>

      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Name / Company</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.map((u) => {
              const profile = u.user_profiles as unknown as { display_name: string | null; credits_balance_cents: number } | null;
              const company = u.company_profiles as unknown as { company_name: string; balance_cents: number } | null;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "company"
                          ? "bg-purple-100 text-purple-700"
                          : u.role === "admin"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {company?.company_name ?? profile?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {company
                      ? `$${(company.balance_cents / 100).toFixed(2)}`
                      : profile
                      ? `$${(profile.credits_balance_cents / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}&role=${role}&q=${q}`}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}&role=${role}&q=${q}`}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
