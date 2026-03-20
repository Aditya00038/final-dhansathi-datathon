'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useBankBalance, ConnectBankPayload } from '@/hooks/useBankBalance';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/layout/Navbar';
import { Loader2 } from 'lucide-react';

const supportedBanks = [
  { id: 'hdfc', name: 'HDFC Bank' },
  { id: 'icici', name: 'ICICI Bank' },
  { id: 'sbi', name: 'State Bank of India' },
  { id: 'axis', name: 'Axis Bank' },
  { id: 'kotak', name: 'Kotak Mahindra Bank' },
  { id: 'other', name: 'Other' },
];

const ConnectBankSchema = z.object({
  bankName: z.string({ required_error: 'Please select a bank.' }),
  accountNickname: z.string().min(2, { message: 'Nickname must be at least 2 characters.' }),
  initialBalance: z.coerce.number().min(0, { message: 'Initial balance cannot be negative.' }),
});

type ConnectBankFormValues = z.infer<typeof ConnectBankSchema>;

export default function ConnectBankPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { connectBank, bankAccount, disconnectedAccount, reconnectBank, loading } = useBankBalance();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewBankForm, setShowNewBankForm] = useState(false);

  useEffect(() => {
    if (!loading && bankAccount) {
      router.replace('/dashboard');
    }
  }, [bankAccount, loading, router]);

  const form = useForm<ConnectBankFormValues>({
    resolver: zodResolver(ConnectBankSchema),
    defaultValues: {
      accountNickname: '',
      initialBalance: 0,
    },
  });

  async function onSubmit(data: ConnectBankFormValues) {
    setIsSubmitting(true);
    try {
      const payload: ConnectBankPayload = {
        bankName: data.bankName,
        accountNickname: data.accountNickname,
        initialBalance: data.initialBalance,
      };
      await connectBank(payload);
      toast({
        title: 'Bank Connected!',
        description: `Your ${data.accountNickname} account is now linked.`,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error connecting bank:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReconnect() {
    setIsSubmitting(true);
    try {
      await reconnectBank();
      toast({
        title: 'Bank Reconnected!',
        description: `Your ${disconnectedAccount?.accountNickname} account is now active again.`,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error reconnecting bank:', error);
      toast({
        variant: 'destructive',
        title: 'Reconnection Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Navbar />
        <div className="container mx-auto max-w-xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Connect a Bank Account</CardTitle>
              <CardDescription>
                Create a virtual bank account to track your balance. Only one account can be linked at a time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disconnectedAccount && !showNewBankForm ? (
                <div className="text-center space-y-4">
                  <p>
                    You have a disconnected account: <strong>{disconnectedAccount.accountNickname}</strong> ({disconnectedAccount.bankName}).
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={handleReconnect} disabled={isSubmitting} className="flex-grow">
                      {isSubmitting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reconnecting...</>
                      ) : (
                        'Reconnect This Account'
                      )}
                    </Button>
                    <Button onClick={() => setShowNewBankForm(true)} variant="outline" className="flex-grow">
                      Connect a Different Bank
                    </Button>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select a Bank</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a bank..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supportedBanks.map((bank) => (
                                <SelectItem key={bank.id} value={bank.name}>
                                  {bank.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accountNickname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Nickname</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., My Savings, Salary Account" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="initialBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Balance (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" placeholder="e.g., 50000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</>
                      ) : (
                        'Connect Bank Account'
                      )}
                    </Button>
                    {disconnectedAccount && (
                      <Button
                        type="button"
                        variant="link"
                        className="w-full mt-2"
                        onClick={() => setShowNewBankForm(false)}
                      >
                        Back to reconnection options
                      </Button>
                    )}
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
