'use client';

import { useState, Suspense, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AIParsedTransaction } from '@/lib/types'; // Using the official type
import { parseSmsAction } from './actions';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useAuth } from '@/contexts/AuthContext';
import { getSavedSmsTransactions, saveCashSpenderTransaction, saveSmsParsedTransactions } from '@/lib/local-store';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const CATEGORY_OPTIONS = ['Food', 'Shopping', 'Travel', 'Bills', 'Payments', 'Person Transfer', 'Income', 'Subscription', 'Competition/Hackathon', 'Charges', 'Others'];

function parseMerchantLabel(label?: string): { brand: string; category: string } {
  if (!label) return { brand: '', category: 'Others' };
  const match = label.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!match) return { brand: label, category: 'Others' };
  return { brand: (match[1] || '').trim(), category: (match[2] || 'Others').trim() };
}

function composeMerchantLabel(brand: string, category: string): string {
  const cleanBrand = brand.trim() || 'Unknown';
  const cleanCategory = category.trim() || 'Others';
  return `${cleanBrand} (${cleanCategory})`;
}

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
  const [cashAmount, setCashAmount] = useState('');
  const [cashDate, setCashDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashMerchant, setCashMerchant] = useState('Cash Expense');
  const [cashCategory, setCashCategory] = useState('Others');
  const [isCashSaving, setIsCashSaving] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [cashEntries, setCashEntries] = useState<AIParsedTransaction[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const all = getSavedSmsTransactions(user.uid);
    const cashOnly = all
      .filter((tx) => tx.source === 'cash-manual')
      .slice(0, 5)
      .map((tx) => ({
        amount: tx.amount,
        date: tx.date,
        merchant: tx.merchant,
        type: tx.type,
      }));
    setCashEntries(cashOnly);

    const loadPhone = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const phone = typeof snap.data().phoneNumber === 'string' ? snap.data().phoneNumber : '';
          setUserPhone(phone || '');
        }
      } catch {
        // Ignore silently; user can still use the feature.
      }
    };

    loadPhone();
  }, [user?.uid]);

  const updateTransaction = (index: number, updater: (tx: AIParsedTransaction) => AIParsedTransaction) => {
    setParsedTransactions((prev) => prev.map((tx, i) => (i === index ? updater(tx) : tx)));
  };

  const removeTransaction = (index: number) => {
    setParsedTransactions((prev) => prev.filter((_, i) => i !== index));
  };

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

  const handleAddCashSpend = async () => {
    if (!user) {
      toast({ title: 'Login Required', description: 'Please log in before adding cash spend.', variant: 'destructive' });
      return;
    }

    if (!bankAccount) {
      toast({
        title: 'Connect Bank First',
        description: 'You must connect a bank account before adding cash spend.',
        variant: 'destructive',
      });
      return;
    }

    const amt = Number(cashAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: 'Invalid Amount', description: 'Enter a valid cash amount.', variant: 'destructive' });
      return;
    }

    setIsCashSaving(true);
    try {
      const saved = saveCashSpenderTransaction(user.uid, {
        amount: amt,
        date: cashDate,
        merchant: cashMerchant,
        category: cashCategory,
        type: 'debit',
      });

      if (!saved) {
        toast({ title: 'Save Failed', description: 'Could not save cash spend.', variant: 'destructive' });
        return;
      }

      const all = getSavedSmsTransactions(user.uid)
        .filter((tx) => tx.source === 'cash-manual')
        .slice(0, 5)
        .map((tx) => ({
          amount: tx.amount,
          date: tx.date,
          merchant: tx.merchant,
          type: tx.type,
        }));
      setCashEntries(all);

      setCashAmount('');
      setCashMerchant('Cash Expense');
      setCashCategory('Others');
      setCashDate(new Date().toISOString().slice(0, 10));
      toast({ title: 'Cash Spend Added', description: 'Your cash transaction has been saved.' });
    } catch (e: any) {
      toast({ title: 'Save Failed', description: e?.message || 'Could not save cash spend.', variant: 'destructive' });
    } finally {
      setIsCashSaving(false);
    }
  };

  const handleSendTestCashReminder = async () => {
    if (!userPhone.trim()) {
      toast({ title: 'Phone Number Missing', description: 'Add your phone number in profile to receive SMS.', variant: 'destructive' });
      return;
    }

    setIsSendingTestSms(true);
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: userPhone,
          message: 'DhanSathi 11PM check-in: Did you spend cash today? Please add it in Cash Spender so your analytics stay accurate.',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Unable to send test SMS');
      }

      toast({ title: 'Test SMS Sent', description: 'Cash reminder SMS was sent for checking.' });
    } catch (e: any) {
      toast({ title: 'SMS Failed', description: e?.message || 'Unable to send test SMS.', variant: 'destructive' });
    } finally {
      setIsSendingTestSms(false);
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
            <CardTitle>Cash Spender</CardTitle>
            <CardDescription>Add money you spent in cash so your reports and goal guidance stay accurate.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div>
                <label className='text-sm font-medium'>Amount (₹)</label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder='e.g. 250'
                />
              </div>
              <div>
                <label className='text-sm font-medium'>Date</label>
                <Input type='date' value={cashDate} onChange={(e) => setCashDate(e.target.value)} />
              </div>
              <div>
                <label className='text-sm font-medium'>Where/Note</label>
                <Input
                  value={cashMerchant}
                  onChange={(e) => setCashMerchant(e.target.value)}
                  placeholder='e.g. Local market'
                />
              </div>
              <div>
                <label className='text-sm font-medium'>Category</label>
                <Select value={cashCategory} onValueChange={setCashCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder='Category' />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='flex flex-col sm:flex-row gap-2'>
              <Button onClick={handleAddCashSpend} disabled={isCashSaving || !bankAccount}>
                {isCashSaving ? 'Saving...' : 'Add Cash Spend'}
              </Button>
              <Button variant='outline' onClick={handleSendTestCashReminder} disabled={isSendingTestSms}>
                {isSendingTestSms ? 'Sending SMS...' : 'Send Test 11PM SMS'}
              </Button>
            </div>

            {cashEntries.length > 0 && (
              <div className='rounded-md border p-3 space-y-2'>
                <p className='text-sm font-medium'>Recent Cash Entries</p>
                {cashEntries.map((entry, idx) => (
                  <div key={`${entry.date || ''}-${entry.amount || 0}-${idx}`} className='text-sm text-muted-foreground flex items-center justify-between'>
                    <span>{entry.date} • {entry.merchant || 'Cash Expense'}</span>
                    <span className='font-medium text-foreground'>₹{Number(entry.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Parser</CardTitle>
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
            <div className='flex flex-col sm:flex-row gap-2'>
              <Button onClick={handleParse} disabled={isLoading}>
                {isLoading ? 'Parsing...' : 'Parse Transactions'}
              </Button>
              <Button variant='outline' asChild>
                <Link href='/scan'>Scan Receipt (OCR + AI)</Link>
              </Button>
            </div>
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
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((t, i) => (
                    <TableRow key={`${t.amount || 0}-${t.date || ''}-${i}`}>
                      <TableCell className='font-medium'>{t.amount ? `₹${t.amount.toFixed(2)}` : 'N/A'}</TableCell>
                      <TableCell>{t.date || 'N/A'}</TableCell>
                      <TableCell>
                        <Input
                          value={parseMerchantLabel(t.merchant).brand}
                          placeholder='Merchant or person name'
                          onChange={(e) => {
                            const parsed = parseMerchantLabel(t.merchant);
                            updateTransaction(i, (old) => ({
                              ...old,
                              merchant: composeMerchantLabel(e.target.value, parsed.category),
                            }));
                          }}
                          className='min-w-[180px]'
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={parseMerchantLabel(t.merchant).category}
                          onValueChange={(value) => {
                            const parsed = parseMerchantLabel(t.merchant);
                            updateTransaction(i, (old) => ({
                              ...old,
                              merchant: composeMerchantLabel(parsed.brand, value),
                            }));
                          }}
                        >
                          <SelectTrigger className='min-w-[150px]'>
                            <SelectValue placeholder='Category' />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((category) => (
                              <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.type || 'debit'}
                          onValueChange={(value: 'debit' | 'credit') => {
                            updateTransaction(i, (old) => ({ ...old, type: value }));
                          }}
                        >
                          <SelectTrigger className='min-w-[110px]'>
                            <SelectValue placeholder='Type' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='debit'>debit</SelectItem>
                            <SelectItem value='credit'>credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant='destructive' size='sm' onClick={() => removeTransaction(i)}>
                          Remove
                        </Button>
                      </TableCell>
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
