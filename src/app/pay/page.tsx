'use client';

import { useState } from 'react';

export default function PublicPayPage() {
    const [amount, setAmount] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch('/api/pay/chapa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    email: email.trim() || undefined,
                    phone_number: phone.trim() || undefined,
                    first_name: firstName.trim() || undefined,
                }),
            });
            const data = (await res.json()) as {
                error?: string;
                checkout_url?: string;
            };
            if (!res.ok || !data.checkout_url) {
                throw new Error(data.error || 'Could not start payment');
            }
            window.location.href = data.checkout_url;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Payment failed');
            setLoading(false);
        }
    }

    return (
        <div className="grid min-h-screen place-items-center bg-gray-50 px-4 py-10">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-lg font-semibold text-gray-900">Pay with Chapa</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Temporary direct payment page. Enter an amount in ETB to continue.
                    </p>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    <div>
                        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
                            Amount (ETB)
                        </label>
                        <input
                            id="amount"
                            type="number"
                            inputMode="decimal"
                            min={1}
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                            placeholder="e.g. 100"
                        />
                    </div>
                    <div>
                        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                            Phone (optional)
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                            placeholder="09xxxxxxxx"
                        />
                    </div>
                    <div>
                        <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                            Name (optional)
                        </label>
                        <input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                            Email (optional)
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="h-10 w-full rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                        {loading ? 'Redirecting…' : 'Pay with Chapa'}
                    </button>
                </form>
            </div>
        </div>
    );
}
