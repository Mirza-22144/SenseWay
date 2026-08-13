import heroImage from "../assets/hero-landing.webp";

// sparse, slow, staggered - a handful of leaves, not a flurry
const LEAVES = [
  { left: "6%", size: 20, delay: "0s", duration: "16s", drift: "34px" },
  { left: "20%", size: 15, delay: "4s", duration: "19s", drift: "-26px" },
  { left: "38%", size: 22, delay: "8s", duration: "15s", drift: "22px" },
  { left: "56%", size: 16, delay: "2s", duration: "18s", drift: "-30px" },
  { left: "73%", size: 18, delay: "10s", duration: "17s", drift: "28px" },
  { left: "88%", size: 20, delay: "6s", duration: "20s", drift: "-22px" },
];

function Leaf({ left, size, delay, duration, drift }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="leaf"
      style={{
        left,
        width: size,
        animationDelay: delay,
        animationDuration: duration,
        "--drift": drift,
      }}
      aria-hidden="true"
    >
      <path d="M12 2C7 4 4 8 4 13c0 5 4 9 8 9s8-4 8-9c0-5-3-9-8-11Z" fill="currentColor" />
    </svg>
  );
}

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <img
        src={heroImage}
        alt="A quiet, tree-lined riverside path along the Yarra with the Melbourne CBD skyline in soft morning light"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

      <div className="leaf-layer pointer-events-none absolute inset-0" aria-hidden="true">
        {LEAVES.map((leaf, i) => (
          <Leaf key={i} {...leaf} />
        ))}
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-start justify-center gap-6 px-8 lg:px-20">
        <h1 className="max-w-xl text-balance text-4xl font-semibold text-white lg:text-5xl">
          Melbourne CBD, minus the overwhelm.
        </h1>
        <p className="max-w-md text-lg text-white/90">
          SenseWay finds calmer, lower-sensory walking routes across the city
          &mdash; and quiet spaces nearby when you need one.
        </p>
        <button
          type="button"
          onClick={onGetStarted}
          className="cursor-pointer rounded-lg bg-brand px-8 py-4 text-base font-semibold text-inverse hover:brightness-95"
        >
          Plan Your Route
        </button>
      </div>
    </div>
  );
}
