import schoolLogo from "../assets/logos/school.png";
import plus2Logo from "../assets/logos/plus2.png";
import collegeLogo from "../assets/logos/college.png";

/**
 * The three institutions, and the details every form carries.
 *
 * THE LOGOS ARE THE ORIGINAL ARTWORK, DRAWN AS-IS.
 * An earlier version of this app vector-traced the mark so it could be
 * recoloured. That subtly redrew it, and it was wrong. Nothing here traces,
 * recolours or filters anything — whatever PNG sits in `src/assets/logos/` is
 * exactly what appears. To change a logo, replace the file; touch no code.
 *
 * The three lockups are not the same shape, which the letterhead has to
 * respect:
 *   school  — a square mark reading "JWS", so the full name is set beside it
 *   plus2   — a wide lockup with the name already inside the artwork
 *   college — likewise
 * `logoHasName` is what tells the letterhead not to print the name twice.
 *
 * Address and phone numbers are identical for all three.
 */

export type Institution = "school" | "plus2" | "college";

export interface InstitutionInfo {
  id: Institution;
  /** Shown in the app when choosing. */
  label: string;
  /** The institution's printed name. */
  name: string;
  tagline: string;
  logo: string;
  /** True when the artwork already contains the name. */
  logoHasName: boolean;
  /** width ÷ height of the artwork, so it can be laid out without guessing. */
  aspect: number;
}

export const ADDRESS = "Madhyapur Thimi–3, Kaushaltar, Bhaktapur";
export const PHONES = ["9744570500", "9744570501", "01-5910299"];
export const PHONE_LINE = PHONES.join("  |  ");

export const INSTITUTIONS: Record<Institution, InstitutionInfo> = {
  school: {
    id: "school",
    label: "School",
    name: "Janapremi World School",
    tagline: "The World Of Learning…",
    logo: schoolLogo,
    logoHasName: false,
    aspect: 1,
  },
  plus2: {
    id: "plus2",
    label: "+2",
    name: "Janapremi World School PLUS 2",
    tagline: "Science | Management | Law",
    logo: plus2Logo,
    logoHasName: true,
    aspect: 1377 / 769,
  },
  college: {
    id: "college",
    label: "College",
    name: "Janapremi College",
    tagline: "Affiliated to Tribhuwan University",
    logo: collegeLogo,
    logoHasName: true,
    aspect: 900 / 387,
  },
};

export const INSTITUTION_LIST = [
  INSTITUTIONS.school,
  INSTITUTIONS.plus2,
  INSTITUTIONS.college,
];

export function institutionOf(id: string | undefined): InstitutionInfo {
  return INSTITUTIONS[(id as Institution) ?? "school"] ?? INSTITUTIONS.school;
}
