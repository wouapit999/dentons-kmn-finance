/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Cameroon national flag as an inline SVG (green / red / yellow vertical bands
// with the gold star on the red band). Scales via className; theme-independent.
export function CameroonFlag({ className, title = "Cameroun" }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 30 20"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="30" height="20" rx="2" fill="#CE1126" />
      <rect width="10" height="20" rx="2" fill="#007A5E" />
      <rect x="9" width="2" height="20" fill="#007A5E" />
      <rect x="20" width="10" height="20" fill="#FCD116" />
      <rect x="19" width="2" height="20" fill="#FCD116" />
      <polygon
        points="15,6.7 15.79,8.91 18.14,8.98 16.28,10.42 16.94,12.67 15,11.35 13.06,12.67 13.72,10.42 11.86,8.98 14.21,8.91"
        fill="#FCD116"
      />
    </svg>
  );
}
