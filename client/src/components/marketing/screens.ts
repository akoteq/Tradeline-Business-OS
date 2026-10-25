import type { StaticImageData } from "next/image";
import companyKpis from "@/app/images/company-kpis.png";
import leads from "@/app/images/leads.png";
import team from "@/app/images/team.png";
import trunqoAi from "@/app/images/trunqo-ai.png";

export type Screen = { src: StaticImageData; alt: string };

/**
 * Product screens used on the landing page. Static imports give next/image the real width and
 * height (no layout shift) and a blur placeholder for free.
 *
 * To swap a screenshot, replace the file in app/images or change the import above.
 */
export const screens: Record<"companyKpis" | "leads" | "team" | "trunqoAi", Screen> = {
  companyKpis: {
    src: companyKpis,
    alt: "The Trunqo Company KPIs page, with each target shown against its owner, progress and status.",
  },
  leads: {
    src: leads,
    alt: "The Trunqo Leads page, listing leads with their priority, owner, follow-up date and status.",
  },
  team: {
    src: team,
    alt: "The Trunqo team view, showing how each person is tracking against their targets.",
  },
  trunqoAi: {
    src: trunqoAi,
    alt: "Ask Trunqo answering a question about KPIs using live data.",
  },
};
