import Image from "next/image";

// Mountain-lake sunset photo used behind the landing hero, with a dark overlay so the text stays readable.
export function HeroBackdrop() {
  return (
    <>
      <Image
        src="/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[40%_60%]"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/50 via-slate-950/25 to-slate-950/70"
        aria-hidden="true"
      />
    </>
  );
}
