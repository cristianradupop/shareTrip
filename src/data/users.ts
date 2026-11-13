import "server-only";
import { asc, count, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

export const USERS_PAGE_SIZE = 10;

export type AdminUserRow = {
  id: string;
  username: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  birthDate: string;
  role: "user" | "admin";
  banned: boolean;
  image: string | null;
  createdAt: string;
};

export async function listUsers(opts: { q?: string; page: number; sort?: "newest" | "name" }) {
  const q = opts.q?.trim();
  const where = q
    ? or(
        ilike(user.email, `%${q}%`),
        ilike(user.username, `%${q}%`),
        ilike(user.firstName, `%${q}%`),
        ilike(user.lastName, `%${q}%`),
      )
    : undefined;

  const [{ total }] = await db.select({ total: count() }).from(user).where(where);
  const rows = await db
    .select()
    .from(user)
    .where(where)
    .orderBy(opts.sort === "name" ? asc(sql`lower(${user.lastName})`) : desc(user.createdAt))
    .limit(USERS_PAGE_SIZE)
    .offset((opts.page - 1) * USERS_PAGE_SIZE);

  const users: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    address: u.address,
    birthDate: u.birthDate,
    role: u.role === "admin" ? "admin" : "user",
    banned: Boolean(u.banned),
    image: u.image,
    createdAt: u.createdAt.toISOString(),
  }));
  return { users, total, pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}
