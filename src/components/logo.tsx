export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M16 2.66663C8.63636 2.66663 2.66667 8.63632 2.66667 16C2.66667 23.3636 8.63636 29.3333 16 29.3333C23.3636 29.3333 29.3333 23.3636 29.3333 16C29.3333 8.63632 23.3636 2.66663 16 2.66663Z"
        fill="url(#paint0_linear_logo)"
      />
      <path
        d="M10.6667 16H14L16 12L18 20L21.3333 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="paint0_linear_logo"
          x1="2.66667"
          y1="16"
          x2="29.3333"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="hsl(var(--accent))" />
          <stop offset="1" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
    </svg>
  );
}
