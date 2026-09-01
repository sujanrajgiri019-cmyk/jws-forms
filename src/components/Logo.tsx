import full from "../assets/logo.svg?raw";
import shield from "../assets/shield.svg?raw";

/**
 * The JWS mark, inlined as SVG (not <img>) so it inherits `currentColor` —
 * orange on paper, white on the orange wall, one file either way.
 *
 * `fluid` lets the surrounding CSS decide the size, which is how the form
 * styles use it.
 */
export function Logo({
  variant = "shield",
  size = 32,
  fluid = false,
  className,
}: {
  variant?: "shield" | "full";
  size?: number;
  fluid?: boolean;
  className?: string;
}) {
  const svg = variant === "full" ? full : shield;
  const sized = fluid
    ? svg.replace("<svg", '<svg style="width:100%;height:auto;display:block"')
    : svg.replace("<svg", `<svg style="height:${size}px;width:auto;display:block"`);

  return (
    <span
      className={className}
      style={
        fluid
          ? { display: "block", lineHeight: 0 }
          : { display: "inline-block", height: size, lineHeight: 0 }
      }
      // Build-time asset from this repo, never user content.
      dangerouslySetInnerHTML={{ __html: sized }}
    />
  );
}
