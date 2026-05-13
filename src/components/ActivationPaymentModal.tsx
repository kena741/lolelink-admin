'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initiateActivationPayment, markActivationPaid, verifyActivationPayment } from '@/features/provider/providerSlice';

interface ActivationPaymentModalProps {
    open: boolean;
    onClose: () => void;
    providerId: string;
    providerName: string;
}

type ModalView = 'main' | 'verify' | 'manual';

interface DebugLog {
    time: string;
    action: string;
    response: unknown;
}

export function ActivationPaymentModal({ open, onClose, providerId, providerName }: ActivationPaymentModalProps) {
    const dispatch = useAppDispatch();
    const feeAmount = useAppSelector(
        (s) => s.settings.settings?.constants?.provider_activation_account_activation_fee_amount || '0'
    );

    const [view, setView] = useState<ModalView>('main');
    const [txRef, setTxRef] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
    const [showDebug, setShowDebug] = useState(true);

    const addDebugLog = (action: string, response: unknown) => {
        setDebugLogs((prev) => [
            { time: new Date().toLocaleTimeString(), action, response },
            ...prev,
        ]);
    };

    const handlePayViaChapa = async () => {
        setLoading(true);
        setError(null);
        addDebugLog('initiateActivationPayment', { providerId, status: 'calling...' });
        try {
            const result = await dispatch(
                initiateActivationPayment({ providerId })
            ).unwrap();
            addDebugLog('initiateActivationPayment SUCCESS', result);
            window.open(result.checkout_url, '_blank');
            setView('verify');
        } catch (err: unknown) {
            addDebugLog('initiateActivationPayment ERROR', err);
            const message = typeof err === 'string' ? err : 'Failed to initialize payment';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        addDebugLog('verifyActivationPayment', { providerId, status: 'calling...' });

        try {
            const rawResponse = await fetch('/api/provider/activate-payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId }),
            });
            const rawData = await rawResponse.json();
            addDebugLog(`verify API (${rawResponse.status})`, rawData);

            if (!rawResponse.ok) {
                setError(rawData.error || `API returned ${rawResponse.status}`);
                setLoading(false);
                return;
            }

            if (rawData.status === 'pending') {
                setError(rawData.message || 'Payment not yet confirmed');
                setLoading(false);
                return;
            }

            if (rawData.wallet_error) {
                setError(`Provider activated but wallet_transaction insert failed: ${rawData.wallet_error}`);
                addDebugLog('wallet_transaction INSERT FAILED', rawData);
                setLoading(false);
                return;
            }

            await dispatch(verifyActivationPayment({ providerId })).unwrap();
            addDebugLog('verifyActivationPayment SUCCESS (provider reloaded)', { providerId });
            setSuccessMessage('Payment verified successfully! Provider account is now active.');
            setTimeout(() => resetAndClose(), 2000);
        } catch (err: unknown) {
            addDebugLog('verifyActivationPayment ERROR', err);
            const message = typeof err === 'string' ? err : 'Verification failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualMark = async () => {
        setLoading(true);
        setError(null);
        addDebugLog('markActivationPaid (manual)', { providerId, txRef, note, status: 'calling...' });

        try {
            const rawResponse = await fetch('/api/provider/activate-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId, mode: 'manual', txRef: txRef.trim() || undefined, note: note.trim() || undefined }),
            });
            const rawData = await rawResponse.json();
            addDebugLog(`manual API (${rawResponse.status})`, rawData);

            if (!rawResponse.ok) {
                setError(rawData.error || `API returned ${rawResponse.status}`);
                setLoading(false);
                return;
            }

            if (rawData.wallet_error) {
                setError(`Provider activated but wallet_transaction insert failed: ${rawData.wallet_error}`);
                setLoading(false);
                return;
            }

            await dispatch(markActivationPaid({ providerId, txRef: txRef.trim() || undefined, note: note.trim() || undefined })).unwrap();
            addDebugLog('markActivationPaid SUCCESS', { providerId });
            resetAndClose();
        } catch (err: unknown) {
            addDebugLog('markActivationPaid ERROR', err);
            const message = typeof err === 'string' ? err : 'Failed to mark activation as paid';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const resetAndClose = () => {
        setView('main');
        setTxRef('');
        setNote('');
        setError(null);
        setSuccessMessage(null);
        onClose();
    };

    const handleClose = () => {
        if (loading) return;
        resetAndClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogHeader>
                <DialogTitle>
                    {view === 'main' && 'Pay Activation Fee'}
                    {view === 'verify' && 'Verify Chapa Payment'}
                    {view === 'manual' && 'Mark Activation as Paid'}
                </DialogTitle>
            </DialogHeader>
            <DialogDescription>
                {view === 'main' && (
                    <>Pay the activation fee for <span className="font-semibold text-card-foreground">{providerName}</span> via Chapa checkout.</>
                )}
                {view === 'verify' && (
                    <>Complete the payment in the Chapa tab, then click verify to confirm.</>
                )}
                {view === 'manual' && (
                    <>Manually confirm that <span className="font-semibold text-card-foreground">{providerName}</span> has paid the activation fee.</>
                )}
            </DialogDescription>

            <div className="mt-4 rounded-md border border-border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Provider ID</span>
                    <span className="font-mono text-xs text-card-foreground">{providerId}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Activation Fee</span>
                    <span className="font-semibold text-card-foreground">ETB {feeAmount}</span>
                </div>
            </div>

            {view === 'main' && (
                <div className="mt-4 flex flex-col gap-3">
                    <Button onClick={handlePayViaChapa} disabled={loading} className="w-full">
                        {loading ? 'Initializing...' : 'Pay via Chapa'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => { setError(null); setView('manual'); }}
                        disabled={loading}
                        className="w-full"
                    >
                        Mark as Paid Manually
                    </Button>
                </div>
            )}

            {view === 'verify' && (
                <div className="mt-4 flex flex-col gap-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        A Chapa checkout tab has been opened. Complete the payment there, then come back and click &quot;Verify Payment&quot;.
                    </div>
                    <Button onClick={handleVerify} disabled={loading} className="w-full">
                        {loading ? 'Verifying...' : 'Verify Payment'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePayViaChapa}
                        disabled={loading}
                        className="w-full"
                    >
                        Reopen Chapa Checkout
                    </Button>
                </div>
            )}

            {view === 'manual' && (
                <div className="mt-4 grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="activation-tx-ref">Transaction Reference (optional)</Label>
                        <Input
                            id="activation-tx-ref"
                            value={txRef}
                            onChange={(e) => setTxRef(e.target.value)}
                            placeholder="e.g. bank receipt number"
                            disabled={loading}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="activation-note">Admin Note (optional)</Label>
                        <Input
                            id="activation-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. paid via CBE transfer"
                            disabled={loading}
                        />
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
                    {successMessage}
                </div>
            )}

            {error && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Debug Panel */}
            <div className="mt-3 border-t border-border pt-3">
                <button
                    onClick={() => setShowDebug((v) => !v)}
                    className="text-xs font-mono text-muted-foreground hover:text-card-foreground transition-colors"
                >
                    {showDebug ? '▼' : '▶'} Debug Logs ({debugLogs.length})
                </button>
                {showDebug && (
                    <div className="mt-2 max-h-[200px] overflow-y-auto rounded-md border border-border bg-gray-950 p-2 space-y-2">
                        {debugLogs.length === 0 && (
                            <p className="text-xs font-mono text-gray-500">No logs yet. Click an action to see responses.</p>
                        )}
                        {debugLogs.map((log, i) => (
                            <div key={i} className="text-xs font-mono">
                                <div className="text-gray-400">[{log.time}] <span className="text-cyan-400">{log.action}</span></div>
                                <pre className="text-green-400 whitespace-pre-wrap break-all mt-0.5">
                                    {typeof log.response === 'string' ? log.response : JSON.stringify(log.response, null, 2)}
                                </pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {view === 'manual' && (
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => { setError(null); setView('main'); }}
                        disabled={loading}
                    >
                        Back
                    </Button>
                    <Button onClick={handleManualMark} disabled={loading}>
                        {loading ? 'Processing...' : 'Confirm Payment'}
                    </Button>
                </DialogFooter>
            )}

            {view === 'verify' && (
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={loading}>
                        Close
                    </Button>
                </DialogFooter>
            )}

            {view === 'main' && (
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                </DialogFooter>
            )}
        </Dialog>
    );
}
