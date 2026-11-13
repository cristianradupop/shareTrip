"use client";

import { Ban, ChevronLeft, ChevronRight, Pencil, Plus, Search, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteUserAction, setBanAction } from "@/app/actions/admin";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-menu";
import type { AdminUserRow } from "@/data/users";

export function UsersTable({
  users,
  total,
  page,
  pages,
  q,
  currentUserId,
}: {
  users: AdminUserRow[];
  total: number;
  page: number;
  pages: number;
  q: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | undefined>();
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);

  function go(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const r = await action();
      if (r.ok) toast.success(success);
      else toast.error(r.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            go({ q: String(value ?? "").trim() || null, page: null });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search name, username or email…" className="w-72 pl-8" />
        </form>
        <span className="text-sm text-muted-foreground">{total} {total === 1 ? "user" : "users"}</span>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus /> Add user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={`${u.firstName} ${u.lastName}`} image={u.image} className="size-9" />
                      <div>
                        <p className="font-medium">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phone}</TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Badge className="gap-1"><ShieldCheck className="size-3" /> Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline">Active</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${u.username}`}
                        title="Edit"
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={self}
                        aria-label={u.banned ? `Unban ${u.username}` : `Ban ${u.username}`}
                        title={u.banned ? "Unban" : "Ban"}
                        onClick={() => run(() => setBanAction(u.id, !u.banned), u.banned ? "User unbanned" : "User banned")}
                      >
                        {u.banned ? <Undo2 /> : <Ban />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={self}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${u.username}`}
                        title="Delete"
                        onClick={() => setToDelete(u)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} aria-label="Previous page" onClick={() => go({ page: String(page - 1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} aria-label="Next page" onClick={() => go({ page: String(page + 1) })}>
            <ChevronRight />
          </Button>
        </div>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.firstName} {toDelete?.lastName} ({toDelete?.email}) will be permanently removed together with
              their trips. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = toDelete?.id;
                setToDelete(null);
                if (id) run(() => deleteUserAction(id), "User deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
