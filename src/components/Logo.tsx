import { institutionOf, ADDRESS, PHONE_LINE, type Institution } from "../lib/brand";

/**
 * The institution mark — the original image file, drawn as-is.
 *
 * No tracing, no recolouring, no filters. `height` drives the size and the
 * width follows the artwork's own proportions, so the square School mark and
 * the wide +2 / College lockups all sit correctly on the same line.
 *
 * `plate` puts it on a white rounded panel, which is how artwork with a white
 * background sits on an orange wall without looking like a mistake.
 */
export function Logo({
  institution = "school",
  height = 40,
  plate = false,
  className,
}: {
  institution?: Institution;
  height?: number;
  plate?: boolean;
  className?: string;
}) {
  const info = institutionOf(institution);
  const img = (
    <img
      src={info.logo}
      alt={info.name}
      style={{ height, width: height * info.aspect, objectFit: "contain", display: "block" }}
      draggable={false}
    />
  );

  if (!plate) return <span className={className} style={{ lineHeight: 0 }}>{img}</span>;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        background: "#fff",
        borderRadius: Math.round(height * 0.2),
        padding: Math.round(height * 0.13),
        lineHeight: 0,
        boxShadow: "0 2px 10px rgba(0,0,0,.12)",
      }}
    >
      {img}
    </span>
  );
}

/**
 * The block that heads every form: the mark, the institution's name, and the
 * address and phone numbers that are the same for all three.
 *
 * When the artwork already contains the name (+2 and College) the name is not
 * typeset again — only the School mark, which reads "JWS", gets the full name
 * set beside it.
 */
export function Letterhead({
  institution = "school",
  height = 58,
  plate = false,
  compact = false,
  onDark = false,
}: {
  institution?: Institution;
  height?: number;
  plate?: boolean;
  compact?: boolean;
  onDark?: boolean;
}) {
  const info = institutionOf(institution);

  const contact = !compact && (
    <div className="lh-contact">
      <span>{ADDRESS}</span>
      <span>{PHONE_LINE}</span>
    </div>
  );

  // Wide lockups carry their own name, so it is not typeset again. The
  // tagline IS typeset: inside the artwork it is a few pixels tall and prints
  // as a grey smudge, and "Affiliated to Tribhuwan University" is exactly the
  // line a parent needs to be able to read.
  if (info.logoHasName) {
    return (
      <div className={`letterhead wide${compact ? " compact" : ""}${onDark ? " on-dark" : ""}`}>
        <Logo institution={institution} height={compact ? height : height * 1.5} plate={plate} />
        {!compact && <div className="lh-tagline lh-wide-tag">{info.tagline}</div>}
        {contact}
      </div>
    );
  }

  return (
    <div className={`letterhead${compact ? " compact" : ""}${onDark ? " on-dark" : ""}`}>
      <div className="lh-row">
        <Logo institution={institution} height={height} plate={plate} />
        <div className="lh-text">
          <div className="lh-name">{info.name}</div>
          <div className="lh-tagline">{info.tagline}</div>
        </div>
      </div>
      {contact}
    </div>
  );
}
