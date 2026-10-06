import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default async function Icon() {
  const logo = await readFile(path.join(process.cwd(), "public/images/site-logo.png"));
  // next/og renders the supplied portrait into a small transparent browser icon.
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/png;base64,${logo.toString("base64")}`} width={64} height={64} alt="" />,
    size,
  );
}
