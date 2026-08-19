/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Cameroon court jurisdictions for litigation matters.
//
// Structure (Judicial Organisation, Law No. 2006/015):
//   - Court of First Instance (Tribunal de Première Instance) — one per
//     subdivision; sits at the subdivision chief town.
//   - High Court (Tribunal de Grande Instance) — one per division (58); sits at
//     the divisional headquarters.
//   - Court of Appeal (Cour d'Appel) — one per region (10); sits at the regional
//     capital.
// The Supreme Court (Yaoundé) is national and not selectable per-matter here.
//
// Location lists below use each division's headquarters town (which hosts both a
// High Court and a Court of First Instance), plus the additional urban court
// seats in Douala and Yaoundé. Court of Appeal selection is limited to the ten
// regional capitals.

export type CourtType = "COURT_OF_FIRST_INSTANCE" | "HIGH_COURT" | "COURT_OF_APPEAL";

export const COURT_TYPES: { value: CourtType; en: string; fr: string }[] = [
  { value: "COURT_OF_FIRST_INSTANCE", en: "Court of First Instance", fr: "Tribunal de Première Instance" },
  { value: "HIGH_COURT", en: "High Court", fr: "Tribunal de Grande Instance" },
  { value: "COURT_OF_APPEAL", en: "Court of Appeal", fr: "Cour d'Appel" },
];

export interface Region {
  code: string;
  name: string;
  capital: string; // seat of the Court of Appeal
  towns: string[]; // court seats in the region (division HQs + urban courts)
}

// Ten regions, their Court-of-Appeal seat (capital) and the court towns within.
export const REGIONS: Region[] = [
  { code: "AD", name: "Adamawa", capital: "Ngaoundéré", towns: ["Ngaoundéré", "Tibati", "Tignère", "Meiganga", "Banyo"] },
  {
    code: "CE", name: "Centre", capital: "Yaoundé",
    towns: [
      "Yaoundé — Centre Administratif", "Yaoundé — Ekounou", "Yaoundé — Ekié", "Obala", "Nanga-Eboko",
      "Monatélé", "Bafia", "Ntui", "Mfou", "Ngoumou", "Éséka", "Akonolinga", "Mbalmayo",
    ],
  },
  { code: "ES", name: "East", capital: "Bertoua", towns: ["Bertoua", "Yokadouma", "Abong-Mbang", "Batouri"] },
  { code: "EN", name: "Far North", capital: "Maroua", towns: ["Maroua", "Kousséri", "Yagoua", "Kaélé", "Mora", "Mokolo"] },
  {
    code: "LT", name: "Littoral", capital: "Douala",
    towns: ["Douala — Bonanjo", "Douala — Bonabéri", "Douala — Ndokoti", "Nkongsamba", "Yabassi", "Édéa", "Manjo", "Loum"],
  },
  { code: "NO", name: "North", capital: "Garoua", towns: ["Garoua", "Poli", "Guider", "Tcholliré"] },
  { code: "NW", name: "North-West", capital: "Bamenda", towns: ["Bamenda", "Fundong", "Kumbo", "Nkambé", "Wum", "Mbengwi", "Ndop"] },
  {
    code: "OU", name: "West", capital: "Bafoussam",
    towns: ["Bafoussam", "Mbouda", "Bafang", "Baham", "Bandjoun", "Dschang", "Bangangté", "Foumban"],
  },
  { code: "SU", name: "South", capital: "Ebolowa", towns: ["Ebolowa", "Sangmélima", "Kribi", "Ambam"] },
  { code: "SW", name: "South-West", capital: "Buea", towns: ["Buea", "Limbe", "Tiko", "Kumba", "Mamfe", "Bangem", "Menji", "Mundemba"] },
];

/** Options for the location dropdown, grouped by region and filtered by court type. */
export function courtLocationGroups(type: CourtType | ""): { region: string; towns: string[] }[] {
  if (type === "COURT_OF_APPEAL") {
    // One Court of Appeal per region, at the regional capital.
    return [{ region: "Regional capitals", towns: REGIONS.map((r) => `${r.capital} (${r.name})`) }];
  }
  // First Instance / High Court: every court town, grouped by region.
  return REGIONS.map((r) => ({ region: r.name, towns: r.towns }));
}

/** Human label for a stored court type. */
export function courtTypeLabel(type: string | null | undefined, locale: "en" | "fr" = "en"): string {
  const m = COURT_TYPES.find((c) => c.value === type);
  return m ? (locale === "fr" ? m.fr : m.en) : "";
}

/** Full jurisdiction label, e.g. "High Court — Bafoussam". */
export function formatCourt(
  type: string | null | undefined,
  location: string | null | undefined,
  locale: "en" | "fr" = "en",
): string {
  const t = courtTypeLabel(type, locale);
  if (!t && !location) return "";
  if (t && location) return `${t} — ${location}`;
  return t || location || "";
}
