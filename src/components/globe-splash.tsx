/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Spatial arena with a rotating globe splash for the login / start page.
// Pure CSS animation (no external assets, no WebGL) so it stays CSP-safe and
// light. Sits behind the login card; decorative and non-interactive.
export function GlobeSplash() {
  return (
    <div className="arena pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="stars" />
      <div className="stars2" />

      {/* Globe centred behind the card, with an orbiting satellite. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="globe-wrap relative" style={{ width: "min(70vw, 460px)", height: "min(70vw, 460px)" }}>
          <div className="globe absolute inset-0" />
          <div className="orbit">
            <div className="orbit-ring" />
            <div className="orbit-run">
              <span className="sat" />
            </div>
          </div>
        </div>
      </div>

      {/* Soft vignette so the login card reads clearly over the scene. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,transparent,rgba(6,4,16,0.55))]" />
    </div>
  );
}
