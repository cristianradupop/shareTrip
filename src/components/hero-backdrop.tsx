// Decorative sunset-over-the-mountains scene used behind the landing hero (pure SVG, no image files).
export function HeroBackdrop() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16213e" />
          <stop offset="0.35" stopColor="#3d4a7a" />
          <stop offset="0.6" stopColor="#c9607f" />
          <stop offset="0.78" stopColor="#f59a5b" />
          <stop offset="1" stopColor="#ffd08a" />
        </linearGradient>
        <radialGradient id="sun" cx="0.55" cy="0.66" r="0.4">
          <stop offset="0" stopColor="#fff2c2" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffb86b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb86b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb3c8" />
          <stop offset="1" stopColor="#1d4e66" />
        </linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1b2b" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1b2b" stopOpacity="0.75" />
        </linearGradient>
        <g id="pine">
          <path d="M0 -60 22 -20h-10l18 28H14l22 34H-36L-14 8h-16l18-28H-22Z" />
          <rect x="-4" y="14" width="8" height="12" />
        </g>
      </defs>

      <rect width="1440" height="900" fill="url(#sky)" />
      <rect width="1440" height="900" fill="url(#sun)" />

      {/* far range */}
      <path d="M0 600 140 470l90 80 120-130 110 120 100-90 130 110 150-170 120 150 110-100 140 130 130-110v320H0Z" fill="#5a5d8c" opacity="0.75" />
      {/* snow caps */}
      <path d="m350 420 30 40-24-8-14 18-14-20-22 8Zm480-70 34 46-26-8-16 20-14-22-24 10Z" fill="#fff" opacity="0.55" />
      {/* mid range */}
      <path d="M0 660 120 560l100 70 150-120 130 110 120-70 160 110 130-80 170 100 130-60 130 80v210H0Z" fill="#2b3a67" opacity="0.92" />

      {/* lake */}
      <rect y="690" width="1440" height="210" fill="url(#lake)" />
      <ellipse cx="800" cy="720" rx="260" ry="14" fill="#ffd08a" opacity="0.45" />
      <ellipse cx="800" cy="742" rx="170" ry="8" fill="#ffd08a" opacity="0.3" />

      {/* foreground hills + pines */}
      <path d="M0 700c120-60 220-70 330-20s190 90 120 200H0Z" fill="#12263a" />
      <path d="M1440 690c-130-50-240-40-330 20s-150 110-90 190h420Z" fill="#12263a" />
      <g fill="#0c1d2d">
        <use href="#pine" x="40" y="770" />
        <use href="#pine" x="110" y="740" transform="translate(0 0) scale(1.1)" />
        <use href="#pine" x="205" y="790" />
        <use href="#pine" x="300" y="800" />
        <use href="#pine" x="1180" y="790" />
        <use href="#pine" x="1260" y="745" />
        <use href="#pine" x="1340" y="780" />
        <use href="#pine" x="1415" y="760" />
      </g>

      {/* darken the bottom so text stays readable */}
      <rect y="450" width="1440" height="450" fill="url(#fade)" />
    </svg>
  );
}
