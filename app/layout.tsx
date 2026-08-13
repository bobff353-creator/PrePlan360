import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://preplan-360.vercel.app",
  ),
  title: "PrePlan 360 | View-Only Product Demo",
  description:
    "A fully fictional PrePlan 360 demonstration for building intelligence, water supply, response, live operations, and incident command.",
  openGraph: {
    title: "PrePlan 360 | View-Only Product Demo",
    description:
      "Explore a fictional department build with made-up departments, people, properties, addresses, incidents, and operational records.",
    images: [{ url: "/og.png", width: 1672, height: 941 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PrePlan 360 | View-Only Product Demo",
    description:
      "A clearly labeled fictional department workspace for connected fire operations workflows.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
