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
          <a className="header-phone" href={`tel:${siteConfig.callPhoneE164}`}>Call {siteConfig.callPhone}</a>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="footer-links">
            <Link href="/privacy">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms">Terms of Use</Link>
            <span>•</span>
            <Link href="/privacy-choices">Privacy Choices</Link>
          </div>
          <p>
            Free & Clear Advantage is a marketing and referral service that helps consumers request information about potential debt-relief options. We are not a lender, law firm, or credit repair organization, and we do not make credit decisions or guarantee enrollment, savings, creditor participation, or any particular result. Availability and program terms vary by provider, state, debt type, and individual circumstances. Debt-relief programs can involve fees and may affect your credit. Review all provider disclosures before enrolling.
          </p>
          <p>© {new Date().getFullYear()} Free & Clear Advantage. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
