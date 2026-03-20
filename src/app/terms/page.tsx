"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
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
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-bold">Terms of Service</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-6">Last updated: February 2025</p>

        <div className="prose dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using DhanSathi ("the Application"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground mb-4">
              DhanSathi is a decentralized savings application that provides:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Off-Chain Savings Goals:</strong> Flexible savings tracking in INR with AI-powered advice</li>
              <li><strong>On-Chain Smart Contract Goals:</strong> Blockchain-secured savings with enforced discipline on Algorand Testnet</li>
              <li><strong>AI Financial Advisor:</strong> Personalized financial guidance and tips</li>
              <li><strong>Achievement NFTs:</strong> ARC-3 compliant NFTs to commemorate completed goals</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Testnet Disclaimer</h2>
            <p className="text-muted-foreground mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <strong>⚠️ Important:</strong> DhanSathi currently operates on the Algorand Testnet. All ALGO tokens used in the application are testnet tokens with no real monetary value. This is a prototype/demonstration application.
            </p>
            <p className="text-muted-foreground">
              Do not send real ALGO or mainnet tokens to this application. We are not responsible for any loss of funds resulting from misuse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. User Responsibilities</h2>
            <p className="text-muted-foreground mb-4">By using DhanSathi, you agree to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Maintain the security of your wallet and private keys</li>
              <li>Provide accurate information when setting savings goals</li>
              <li>Understand the nature of blockchain transactions (irreversible)</li>
              <li>Use the Application only for lawful purposes</li>
              <li>Not attempt to exploit, hack, or manipulate the smart contracts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Smart Contract Terms</h2>
            <p className="text-muted-foreground mb-4">
              When you create an On-Chain Smart Contract Goal:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Your funds are locked in an Algorand smart contract</li>
              <li>Withdrawals are only possible when the goal is completed OR the deadline passes</li>
              <li>This is the "Discipline-as-a-Service" feature and is by design</li>
              <li>You cannot cancel or modify the smart contract after deployment</li>
              <li>Gas/transaction fees apply to all blockchain operations</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              By deploying a smart contract goal, you acknowledge and accept these restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. AI Advisory Disclaimer</h2>
            <p className="text-muted-foreground">
              The AI-powered financial advice provided by DhanSathi is for informational and educational purposes only. It does not constitute professional financial advice. Always consult with a qualified financial advisor before making significant financial decisions. We are not responsible for any financial outcomes resulting from following AI suggestions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The DhanSathi name, logo, and application design are our intellectual property. Achievement NFTs minted through the application are owned by the user who mints them, with the underlying artwork/metadata remaining our property.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the maximum extent permitted by law, DhanSathi and its creators shall not be liable for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Loss of funds due to user error, wallet compromise, or blockchain issues</li>
              <li>Inability to withdraw funds before goal completion (by design)</li>
              <li>Smart contract vulnerabilities or exploits</li>
              <li>Incorrect AI-generated advice</li>
              <li>Third-party service outages (Algorand, Pera Wallet, etc.)</li>
              <li>Loss of local data due to browser clearing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Service Availability</h2>
            <p className="text-muted-foreground">
              We strive to maintain continuous service availability but do not guarantee uninterrupted access. The Application may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. As a prototype, features may change without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Termination</h2>
            <p className="text-muted-foreground">
              You may stop using DhanSathi at any time by disconnecting your wallet. Note that on-chain smart contracts will continue to exist and function according to their programmed logic regardless of your use of the Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. Continued use of the Application after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-primary mt-2">legal@dhansathi.app</p>
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
