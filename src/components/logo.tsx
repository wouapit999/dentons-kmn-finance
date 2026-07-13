// Dentons KMN brand mark, recreated as inline SVG so it scales crisply at any
// size and renders identically in light and dark mode. Brand purple: #6D2077.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 760 110"
      role="img"
      aria-label="Dentons KMN"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Purple banner with a rounded left edge and a right-pointing arrow */}
      <path
        d="M14 4 H500 L560 55 L500 106 H14 A10 10 0 0 1 4 96 V14 A10 10 0 0 1 14 4 Z"
        fill="#6D2077"
      />
      <text
        x="252"
        y="74"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontSize="58"
        fontWeight="800"
        letterSpacing="3"
      >
        DENTONS
      </text>
      <text
        x="586"
        y="74"
        fill="#6D2077"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontSize="62"
        fontWeight="800"
        letterSpacing="1"
      >
        KMN
      </text>
    </svg>
  );
}
