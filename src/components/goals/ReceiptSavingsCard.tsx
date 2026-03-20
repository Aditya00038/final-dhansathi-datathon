"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrainCircuit, Loader2, Sparkles, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeReceipt } from '@/ai/flows/ai-receipt-analysis-flow';
import type { GoalWithOnChainData } from '@/lib/types';
import { DepositDialog } from './DepositDialog';
import { useRouter } from 'next/navigation';
import { formatAlgoWithInr } from '@/lib/utils';

type ReceiptSavingsCardProps = {
    goals: GoalWithOnChainData[];
};

export default function ReceiptSavingsCard({ goals }: ReceiptSavingsCardProps) {
    const [selectedGoalId, setSelectedGoalId] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ amount: number; reason: string } | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setAnalysisResult(null);
        }
    };
    
    const handleAnalyze = async () => {
        if (!selectedFile || !selectedGoalId) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a goal and a receipt file.' });
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = async () => {
            const imageDataUri = reader.result as string;
            const selectedGoal = goals.find(g => g.id === selectedGoalId);

            try {
                const result = await analyzeReceipt({
                    imageDataUri,
                    goalName: selectedGoal?.name || 'your goal',
                });
                setAnalysisResult({ amount: result.suggestedAmount, reason: result.reason });
            } catch (error) {
                console.error('Error analyzing receipt:', error);
                toast({ variant: 'destructive', title: 'Analysis Failed', description: 'Could not get suggestion from AI.' });
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not process the selected file.' });
            setIsAnalyzing(false);
        };
    };

    const selectedGoal = goals.find(g => g.id === selectedGoalId);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center"><BrainCircuit className="mr-2 text-primary" /> AI Smart Savings</CardTitle>
                <CardDescription>Upload a receipt to get an AI-powered micro-savings suggestion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={setSelectedGoalId} value={selectedGoalId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a goal..." />
                    </SelectTrigger>
                    <SelectContent>
                        {goals.length > 0 ? (
                            goals.map(goal => (
                                <SelectItem key={goal.id} value={goal.id} disabled={goal.onChain.goalCompleted}>
                                    {goal.name}
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">No active goals found.</div>
                        )}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <Input id="receipt-upload" type="file" accept="image/*" onChange={handleFileChange} className="pl-10" />
                    <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                
                <Button onClick={handleAnalyze} disabled={!selectedFile || !selectedGoalId || isAnalyzing} className="w-full">
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2" />}
                    {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                </Button>

                {analysisResult && selectedGoal && (
                    <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
                        <Textarea
                            readOnly
                            value={`AI Coach says: "${analysisResult.reason}"`}
                            className="text-sm bg-transparent border-0"
                        />
                         <DepositDialog
                            goalId={selectedGoal.id}
                            goalName={selectedGoal.name}
                            appId={selectedGoal.appId}
                            initialAmount={analysisResult.amount}
                            onDepositSuccess={() => {
                                setAnalysisResult(null);
                                setSelectedFile(null);
                                // A bit of a hack to reset the file input visually
                                const input = document.getElementById('receipt-upload') as HTMLInputElement;
                                if(input) input.value = '';
                                router.refresh();
                            }}
                            trigger={
                                <Button className="w-full" size="sm">
                                    {`Deposit ${formatAlgoWithInr(analysisResult.amount)} Now`}
                                </Button>
                            }
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
