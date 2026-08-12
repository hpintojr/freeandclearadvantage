import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Free & Clear Advantage | Explore Debt Relief Options",
  description: siteConfig.description,
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Free & Clear Advantage home">
            <Image src="/logo.svg" width={246} height={75} alt="Free & Clear Advantage" priority />
          </Link>
          <a
            className="header-phone"
            href={`tel:${siteConfig.callPhoneE164}`}
            aria-label={`Call Free & Clear Advantage at ${siteConfig.callPhone}`}
          >
            <svg
              className="phone-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span className="phone-label">Call {siteConfig.callPhone}</span>
          </a>
        </header>
        <div style={{ background: "#eef6ff", borderBottom: "1px solid #dce4ee", padding: "8px 16px", textAlign: "center", fontSize: ".78rem", color: "#52657a" }}>
          Before entering information, review our <Link href="/notice-at-collection">Notice at Collection</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </div>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="footer-links">
            <Link href="/privacy">Privacy Policy</Link>
            <span>•</span>
            <Link href="/notice-at-collection">Notice at Collection</Link>
            <span>•</span>
            <Link href="/terms">Terms of Use</Link>
            <span>•</span>
            <Link href="/privacy-choices">Privacy Choices</Link>
          </div>
          <p>
            Free & Clear Advantage provides information and facilitates requests regarding potential debt-relief options. We are not a lender, law firm, or credit repair organization, and we do not make credit decisions or guarantee enrollment, savings, creditor participation, or any particular result. Availability and program terms vary by provider, state, debt type, and individual circumstances. Debt-relief programs can involve fees and may affect your credit. Review all provider disclosures before enrolling.
          </p>
          <p>© {new Date().getFullYear()} Free & Clear Advantage. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
