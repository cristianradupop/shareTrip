import Image from "next/image";

// Illustrated tropical sunset behind the landing hero (same style as the panels beside the feed),
// with a light dark overlay so the heading stays readable.
export function HeroBackdrop() {
  return (
    <>
      <Image
        src="/hero-tropic.svg"
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className="-z-20 object-cover object-[50%_60%]"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/45 via-slate-950/10 to-slate-950/40"
        aria-hidden="true"
      />
    </>
  );
}
