"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createUserAction, updateUserAction } from "@/app/actions/admin";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminUserRow } from "@/data/users";
import { adminUserSchema, signUpSchema } from "@/lib/validators";

const createSchema = adminUserSchema.extend({ password: signUpSchema.shape.password });
const editSchema = adminUserSchema.extend({
  // Leave empty to keep the current password.
  password: z.union([z.literal(""), signUpSchema.shape.password]).optional(),
});
type FormValues = z.infer<typeof createSchema>;

const ROLES = [
  { value: "user", label: "User" },
  { value: "admin", label: "Administrator" },
];

const EMPTY: FormValues = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  birthDate: "",
  role: "user",
  password: "",
};

const toValues = (user?: AdminUserRow): FormValues =>
  user
    ? {
        username: user.username ?? "",
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        birthDate: user.birthDate,
        role: user.role,
        password: "",
      }
    : EMPTY;

/** Create (user = undefined) or edit a user. The form is mounted only while open, so it starts fresh every time. */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUserRow;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {open && <UserForm user={user} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ user, onClose }: { user?: AdminUserRow; onClose: () => void }) {
  const editing = Boolean(user);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(editing ? (editSchema as unknown as typeof createSchema) : createSchema),
    defaultValues: toValues(user),
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = user ? await updateUserAction(user.id, values) : await createUserAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success(user ? "User updated" : "User created");
    onClose();
  }

  const field = (name: keyof FormValues, label: string, type = "text", wide = false, hint?: string) => (
    <FormField
      label={label}
      htmlFor={`u-${name}`}
      error={errors[name]?.message as string | undefined}
      invalid={Boolean(errors[name])}
      hint={hint}
      className={wide ? "sm:col-span-2" : undefined}
    >
      <Input id={`u-${name}`} type={type} aria-invalid={Boolean(errors[name])} {...register(name)} />
    </FormField>
  );

  return (
    <>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the account details." : "Create an account on behalf of a user."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("firstName", "First name")}
            {field("lastName", "Last name")}
            {field("username", "Username")}
            {field("email", "Email address", "email")}
            {field("phone", "Phone number", "tel")}
            {field("birthDate", "Birth date", "date")}
            {field("address", "Address", "text", true)}
            {field("password", editing ? "New password" : "Password", "password", false, editing ? "Leave empty to keep the current one" : undefined)}
            <FormField label="Role" htmlFor="u-role" error={errors.role?.message} invalid={Boolean(errors.role)}>
              <Controller
                control={control}
                name="role"
                render={({ field: f }) => (
                  <Select items={ROLES} value={f.value} onValueChange={(v) => f.onChange(v ?? "user")}>
                    <SelectTrigger id="u-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create user"}
            </Button>
          </div>
        </form>
    </>
  );
}
