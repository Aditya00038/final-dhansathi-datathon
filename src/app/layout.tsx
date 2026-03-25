import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import ConditionalChatBot from "@/components/layout/ConditionalChatBot";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import DevServiceWorkerCleanup from "@/components/pwa/DevServiceWorkerCleanup";
import ConditionalLanguageSelector from "@/components/layout/ConditionalLanguageSelector";
import Script from "next/script";

const inter = { className: "font-sans" };

export const metadata: Metadata = {
  title: "DhanSathi - AI-Powered Financial Management",
  description: "Track your finances with AI-powered insights and secure your savings on the Algorand blockchain.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/DhanSathi.png",
    shortcut: "/icons/DhanSathi.png",
    apple: "/icons/DhanSathi.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DhanSathi",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "DhanSathi - AI Financial Companion",
    description: "Track your finances with AI-powered insights and secure your savings on blockchain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#22c55e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <link rel="icon" href="/icons/DhanSathi.png" type="image/png" />
        <link rel="shortcut icon" href="/icons/DhanSathi.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/DhanSathi.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Google Translate Widget */}
        <Script
          strategy="afterInteractive"
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              window.__googleTranslateReady = true;
            }
          `}
        </Script>

        {/* Razorpay Checkout Script */}
        <Script
          id="razorpay-checkout-js"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <WalletProvider>
              {children}
              <DevServiceWorkerCleanup />
              <ConditionalChatBot />
              <ConditionalLanguageSelector />
              <InstallPrompt />
              <Toaster />
            </WalletProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
