import QRCode from "qrcode";

/**
 * Rendered as SVG paths rather than a data-URL <img>: no extra request, crisp at
 * any size, and it inherits the retro palette instead of fighting it.
 */
export function QrCode({
  value,
  className,
  quietZone = 2,
}: {
  value: string;
  className?: string;
  quietZone?: number;
}) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const grid = qr.modules.data;
  const span = modules + quietZone * 2;

  let path = "";
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (grid[row * modules + column]) {
        path += `M${column + quietZone} ${row + quietZone}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={`QR code for ${value}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#fff4e2" />
      <path d={path} fill="#251a42" />
    </svg>
  );
}
