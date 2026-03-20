'use client';

import { useState, Suspense } from 'react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { AIParsedTransaction } from '@/lib/types'; // Using the official type
import { parseSmsAction } from './actions';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useAuth } from '@/contexts/AuthContext';
import { saveSmsParsedTransactions } from '@/lib/local-store';
import Link from 'next/link';

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong className="font-bold">Error:</strong>
      <span className="block sm:inline"> {message}</span>
    </div>
  );
}

export default function SmsParserPage() {
  const [smsInput, setSmsInput] = useState('');
  const [parsedTransactions, setParsedTransactions] = useState<AIParsedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { bankAccount, updateBalance } = useBankBalance();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleParse = async () => {
    if (!smsInput.trim()) {
      toast({ title: 'Empty Input', description: 'Please paste your SMS messages.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setParsedTransactions([]);
    setError(null);

    try {
      const result = await parseSmsAction(smsInput);

      if (result.success) {
        setParsedTransactions(result.transactions);
        toast({ title: 'Parsing Successful', description: `Found ${result.transactions.length} transactions.` });
      } else {
        setError(result.error || 'An unknown server error occurred.');
        toast({ title: 'Parsing Failed', description: result.error, variant: 'destructive' });
      }
    } catch (e: any) {
      setError('A critical client-side error occurred.');
      toast({ title: 'Critical Error', description: e.message, variant: 'destructive' });
    }

    setIsLoading(false);
  };

  const handleSaveTransactions = async () => {
    if (!user) {
      toast({ title: 'Login Required', description: 'Please log in before saving transactions.', variant: 'destructive' });
      return;
    }

    if (!bankAccount) {
      toast({
        title: 'Connect Bank First',
        description: 'You must connect a bank account before saving parsed transactions.',
        variant: 'destructive',
      });
      return;
    }

    if (parsedTransactions.length === 0) {
      toast({ title: 'No Transactions', description: 'Parse SMS messages first.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const saved = saveSmsParsedTransactions(user.uid, parsedTransactions);
      if (saved.length === 0) {
        toast({ title: 'Nothing New to Save', description: 'All parsed transactions were already saved.' });
        return;
      }

      const balanceImpact = saved.reduce((sum, tx) => sum + (tx.type === 'debit' ? -tx.amount : tx.amount), 0);
      if (balanceImpact !== 0) {
        await updateBalance(balanceImpact);
      }

      toast({ title: 'Transactions Saved', description: `${saved.length} transaction(s) saved successfully.` });
    } catch (e: any) {
      toast({ title: 'Save Failed', description: e?.message || 'Could not save transactions.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='min-h-screen bg-background pb-20 md:pb-0'>
      <Navbar />
      <main className='max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-6'>
        {error && <ErrorDisplay message={error} />}

        <Card>
        <CardHeader>
            <CardTitle>Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p>Loading balance...</p>}>
              <p className='text-3xl font-bold'>
                {bankAccount ? `₹${bankAccount.balance.toLocaleString()}` : 'Not connected'}
              </p>
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMS Paste Transaction Detection</CardTitle>
            <CardDescription>Paste one or multiple bank SMS messages below to automatically extract transaction details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={smsInput}
              onChange={(e) => setSmsInput(e.target.value)}
              placeholder='Paste your bank SMS messages here...'
              className='min-h-[200px] text-sm'
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleParse} disabled={isLoading}>
              {isLoading ? 'Parsing...' : 'Parse Transactions'}
            </Button>
          </CardFooter>
        </Card>

        {parsedTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parsed Transactions</CardTitle>
              <CardDescription>Review the extracted transactions below before saving.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className='font-medium'>{t.amount ? `₹${t.amount.toFixed(2)}` : 'N/A'}</TableCell>
                      <TableCell>{t.date || 'N/A'}</TableCell>
                      <TableCell>{t.merchant || 'N/A'}</TableCell>
                      <TableCell>{t.type || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
                <Button onClick={handleSaveTransactions} disabled={isSaving || !bankAccount}>
                  {isSaving ? 'Saving...' : 'Save Transactions'}
                </Button>
                <Button variant='outline' asChild>
                  <Link href='/analytics'>View Spending Insights in Analytics</Link>
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}
