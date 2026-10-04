import type { Metadata, Viewport } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({
  variable: "--font-pixel-face",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const rounded = Nunito({
  variable: "--font-rounded-face",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TripCancil — plan it, split it, shoot it",
    template: "%s · TripCancil",
  },
  description:
    "Plan the trip, split the money, make photobooth memories, relive it all later.",
};

export const viewport: Viewport = {
  themeColor: "#fff4e2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${pixel.variable} ${rounded.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
