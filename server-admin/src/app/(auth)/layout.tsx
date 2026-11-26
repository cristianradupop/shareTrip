import Image from "next/image";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import alpsPhoto from "../../../public/photos/alps-clouds.jpg";

// Split screen: a big rounded photo on the left (wide screens), the form on the right.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-[1920px] gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative isolate hidden overflow-hidden rounded-[2rem] bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Image
          src={alpsPhoto}
          alt="Snowy mountain peaks above a sea of clouds at sunset"
          fill
          priority
          placeholder="blur"
          sizes="50vw"
          className="-z-20 object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-black/40" />
        <Logo className="[&_span_span]:text-white" />
        <div>
          <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Every great trip starts with the right people.
          </p>
          <p className="mt-4 max-w-sm text-white/75">Organize your own adventure or join a crew that is already on its way.</p>
        </div>
      </aside>

      <div className="relative flex flex-col items-center justify-center rounded-[2rem] bg-card px-5 py-14 sm:px-10">
        <ThemeToggle className="absolute right-4 top-4 rounded-full" />
        <Logo className="mb-8 lg:hidden" />
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
