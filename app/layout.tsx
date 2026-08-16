import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dino Park Engineer",
  description: "Engineer reliable AI agents while operating a deterministic automated dinosaur park.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
