import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-orange-50 via-background to-teal-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />
      <Logo className="mb-6 text-primary" />
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
