'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBankBalance } from '@/hooks/useBankBalance';
import { db } from '@/lib/firebase';
import { saveSmsParsedTransactions } from '@/lib/local-store';
import { parseReceiptTextAction } from './actions';

type ReceiptCategory = 'Food' | 'Shopping' | 'Travel' | 'Bills' | 'Others';

type ParsedForm = {
  amount: string;
  merchant: string;
  category: ReceiptCategory;
  type: 'debit' | 'credit';
  date: string;
};

const CATEGORY_OPTIONS: ReceiptCategory[] = ['Food', 'Shopping', 'Travel', 'Bills', 'Others'];

function cleanOcrText(text: string): string {
  return text
    .replace(/[|]+/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export default function ScanPage() {
  const { user } = useAuth();
  const { bankAccount, updateBalance } = useBankBalance();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [cleanedText, setCleanedText] = useState('');

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ParsedForm | null>(null);

  const canParse = !!file && !!user && !uploading && !scanning;
  const canSave = !!form && !!user && !saving && bankAccount?.status === 'active';

  const scanStatusText = useMemo(() => {
    if (!scanning) return '';
    if (ocrProgress <= 0) return 'Scanning receipt...';
    return `Scanning receipt... ${Math.round(ocrProgress * 100)}%`;
  }, [scanning, ocrProgress]);

  const onSelectFile = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setForm(null);
    setReceiptUrl(null);
    setOcrText('');
    setCleanedText('');
    setOcrProgress(0);
  };

  const onDropFile = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const dropped = ev.dataTransfer.files?.[0] || null;
    onSelectFile(dropped);
  };

  const uploadReceiptImage = async (selectedFile: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated.');
    
    // Upload via API route (converts to base64, bypasses CORS issues)
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userId', user.uid);

    const response = await fetch('/api/upload-receipt', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    return result.receiptData; // Base64 data URL
  };

  const parseReceipt = async () => {
    if (!file || !user) {
      toast({ title: 'Missing data', description: 'Please upload a receipt image first.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      const uploadedUrl = await uploadReceiptImage(file);
      setReceiptUrl(uploadedUrl);
      setUploading(false);

      setScanning(true);
      setOcrProgress(0);
      const tesseractModule = await import('tesseract.js');
      const tesseract = tesseractModule.default;

      const result = await tesseract.recognize(file, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(m.progress || 0);
          }
        },
      });

      const rawText = result.data.text || '';
      const cleaned = cleanOcrText(rawText);
      setOcrText(rawText);
      setCleanedText(cleaned);

      const parsed = await parseReceiptTextAction(cleaned);
      if (!parsed.success || !parsed.data) {
        toast({ title: 'Parse failed', description: parsed.error || 'Could not parse receipt.', variant: 'destructive' });
        return;
      }

      setForm({
        amount: parsed.data.amount.toString(),
        merchant: parsed.data.merchant,
        category: parsed.data.category,
        type: 'debit',
        date: parsed.data.date || new Date().toISOString().slice(0, 10),
      });

      toast({ title: 'Receipt parsed', description: 'Review details and save transaction.' });
    } catch (error: any) {
      toast({ title: 'Scan failed', description: error?.message || 'Unable to scan this receipt.', variant: 'destructive' });
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  const saveTransaction = async () => {
    if (!user || !form) return;

    if (bankAccount?.status !== 'active') {
      toast({
        title: 'Connect Bank First',
        description: 'Please connect an active bank account to save scanned transactions.',
        variant: 'destructive',
      });
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    if (!form.merchant.trim()) {
      toast({ title: 'Missing merchant', description: 'Please provide merchant name.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        amount,
        merchant: form.merchant.trim(),
        category: form.category,
        type: form.type,
        date: form.date || null,
        source: 'OCR',
        imageUrl: receiptUrl || null,
        createdAt: serverTimestamp(),
      });

      // Keep OCR-scanned transactions available for analytics graphs.
      saveSmsParsedTransactions(user.uid, [
        {
          amount,
          merchant: form.merchant.trim(),
          date: form.date || new Date().toISOString().slice(0, 10),
          type: form.type,
        },
      ]);

      if (bankAccount?.status === 'active') {
        const delta = form.type === 'debit' ? -amount : amount;
        if (delta !== 0) {
          await updateBalance(delta);
        }
        toast({ title: 'Saved', description: 'Transaction saved, analytics updated, and bank balance synced.' });
      } else {
        toast({ title: 'Saved', description: 'Transaction saved for analytics. Connect bank to auto-sync balance.' });
      }
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Could not save transaction.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className='min-h-screen bg-background pb-20 md:pb-0'>
        <Navbar />
        <main className='max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-6'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold tracking-tight'>Scan Receipt</h1>
              <p className='text-sm text-muted-foreground mt-1'>Upload receipt, extract with OCR + AI, edit and save.</p>
            </div>
            <Button asChild variant='outline'>
              <Link href='/sms-parser'>Back to Transaction Parser</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload Receipt</CardTitle>
              <CardDescription>Drag and drop an image, or choose from your device.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div
                className='rounded-lg border border-dashed border-border/70 p-6 text-center hover:bg-muted/30 transition-colors'
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropFile}
              >
                <p className='text-sm text-muted-foreground mb-3'>Drop receipt image here</p>
                <Input type='file' accept='image/*' onChange={(e) => onSelectFile(e.target.files?.[0] || null)} />
              </div>

              {previewUrl && (
                <div className='rounded-md border p-2'>
                  <img src={previewUrl} alt='Receipt preview' className='max-h-96 mx-auto rounded' />
                </div>
              )}

              {(uploading || scanning) && (
                <div className='rounded-md bg-muted p-3'>
                  <p className='text-sm font-medium'>{uploading ? 'Uploading receipt image...' : scanStatusText}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={parseReceipt} disabled={!canParse}>
                {uploading ? 'Uploading...' : scanning ? 'Scanning...' : 'Extract Receipt Data'}
              </Button>
            </CardFooter>
          </Card>

          {form && (
            <Card>
              <CardHeader>
                <CardTitle>Review Extracted Data</CardTitle>
                <CardDescription>Edit values before saving.</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label>Merchant</Label>
                    <Input value={form.merchant} onChange={(e) => setForm((prev) => (prev ? { ...prev, merchant: e.target.value } : prev))} />
                  </div>
                  <div className='space-y-2'>
                    <Label>Amount</Label>
                    <Input type='number' min={0} step={0.01} value={form.amount} onChange={(e) => setForm((prev) => (prev ? { ...prev, amount: e.target.value } : prev))} />
                  </div>
                  <div className='space-y-2'>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(value) => setForm((prev) => (prev ? { ...prev, category: value as ReceiptCategory } : prev))}>
                      <SelectTrigger>
                        <SelectValue placeholder='Category' />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>Transaction Type</Label>
                    <Select value={form.type} onValueChange={(value) => setForm((prev) => (prev ? { ...prev, type: value as 'debit' | 'credit' } : prev))}>
                      <SelectTrigger>
                        <SelectValue placeholder='Type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='debit'>Debit (expense)</SelectItem>
                        <SelectItem value='credit'>Credit (income/refund)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>Date</Label>
                    <Input type='date' value={form.date} onChange={(e) => setForm((prev) => (prev ? { ...prev, date: e.target.value } : prev))} />
                  </div>
                </div>

                <details className='rounded-md border p-3'>
                  <summary className='cursor-pointer text-sm font-medium'>View OCR text</summary>
                  <Textarea readOnly value={cleanedText || ocrText} className='mt-3 min-h-[140px] text-xs' />
                </details>
              </CardContent>
              <CardFooter>
                <Button onClick={saveTransaction} disabled={!canSave}>
                  {saving ? 'Saving...' : 'Save Transaction'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
