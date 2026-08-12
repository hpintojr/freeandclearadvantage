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
              <path
                d="M7.2 3.5c.5-.5 1.3-.6 1.9-.2l2.1 1.4c.6.4.8 1.1.5 1.8l-1 2.3c-.2.5-.1 1 .3 1.4l2.8 2.8c.4.4.9.5 1.4.3l2.3-1c.7-.3 1.4-.1 1.8.5l1.4 2.1c.4.6.3 1.4-.2 1.9l-1.5 1.5c-1.2 1.2-3 1.7-4.6 1.2-2.7-.8-5.3-2.5-7.6-4.8S2.8 9.8 2 7.1c-.5-1.6 0-3.4 1.2-4.6L4.7 1"
                transform="translate(1 1)"
              />
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
