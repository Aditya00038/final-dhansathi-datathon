"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="ml-4 flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold">Privacy Policy</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-6">Last updated: February 2025</p>

        <div className="prose dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground">
              Welcome to DhanSathi ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our decentralized savings application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2">2.1 Wallet Information</h3>
            <p className="text-muted-foreground mb-4">
              When you connect your Algorand wallet, we access your public wallet address to enable transactions. We never have access to your private keys or seed phrases.
            </p>
            
            <h3 className="text-lg font-medium mb-2">2.2 Savings Data</h3>
            <p className="text-muted-foreground mb-4">
              We store your savings goals, deposit history, and progress locally on your device using browser localStorage. On-chain data (smart contract goals) is stored on the Algorand blockchain and is publicly accessible.
            </p>

            <h3 className="text-lg font-medium mb-2">2.3 Usage Data</h3>
            <p className="text-muted-foreground">
              We may collect anonymous usage statistics to improve our service, including pages visited, features used, and general interaction patterns. This data does not identify you personally.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>To provide and maintain our savings tracking service</li>
              <li>To process your deposits and withdrawals through smart contracts</li>
              <li>To generate personalized AI-powered financial advice</li>
              <li>To display your achievements and progress</li>
              <li>To improve our application and user experience</li>
              <li>To communicate important updates about the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Storage & Security</h2>
            <p className="text-muted-foreground mb-4">
              <strong>Local Storage:</strong> Off-chain savings data is stored locally in your browser. This data remains on your device and is not transmitted to our servers.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Blockchain Storage:</strong> On-chain smart contract goals are stored on the Algorand Testnet blockchain. This data is publicly accessible and immutable.
            </p>
            <p className="text-muted-foreground">
              <strong>AI Processing:</strong> When using AI features, your financial context may be processed by Google's AI services. We only share anonymized data necessary to provide personalized advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">Our application integrates with:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Algorand Blockchain:</strong> For smart contract execution and NFT minting</li>
              <li><strong>Pera Wallet:</strong> For wallet connection and transaction signing</li>
              <li><strong>Google AI (Gemini):</strong> For personalized financial advice</li>
              <li><strong>Google Translate:</strong> For multi-language support</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Each third-party service has its own privacy policy. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access your stored data (via browser developer tools)</li>
              <li>Delete your local data by clearing browser storage</li>
              <li>Disconnect your wallet at any time</li>
              <li>Request information about data processing</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Note: On-chain data cannot be deleted due to the immutable nature of blockchain technology.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Children's Privacy</h2>
            <p className="text-muted-foreground">
              DhanSathi is intended for users aged 18 and above. We do not knowingly collect personal information from children under 18. If you believe we have collected such information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify users of any material changes by posting the new policy on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-primary mt-2">privacy@dhansathi.app</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
