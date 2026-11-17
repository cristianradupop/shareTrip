"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function useLogout() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };
}

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const logout = useLogout();
  return (
    <Button variant="ghost" className={className} onClick={logout}>
      {children ?? (
        <>
          <LogOut className="size-4" /> Logout
        </>
      )}
    </Button>
  );
}

export function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar className={className}>
      {image ? <AvatarImage src={image} alt={name} /> : null}
      <AvatarFallback className="bg-primary/15 text-primary">{initials}</AvatarFallback>
    </Avatar>
  );
}
