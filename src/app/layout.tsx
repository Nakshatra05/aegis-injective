import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Aegis — Give agents limits. Keep control.",
  description:
    "Delegate trading on Injective testnet with enforceable permissions, spending caps, and instant revocation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
