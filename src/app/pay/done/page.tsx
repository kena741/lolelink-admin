import Link from 'next/link';

export default async function PayDonePage({
    searchParams,
}: {
    searchParams: Promise<{ tx_ref?: string }>;
}) {
    const params = await searchParams;
    const txRef = (params.tx_ref ?? '').trim();

    return (
        <div className="grid min-h-screen place-items-center bg-gray-50 px-4 py-10">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                <h1 className="text-lg font-semibold text-gray-900">Payment submitted</h1>
                <p className="mt-2 text-sm text-gray-600">
                    If you completed checkout on Chapa, the payment should appear in your Chapa dashboard shortly.
                </p>
                {txRef ? (
                    <p className="mt-3 break-all font-mono text-xs text-gray-500">Ref: {txRef}</p>
                ) : null}
                <Link
                    href="/pay"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
                >
                    Make another payment
                </Link>
            </div>
        </div>
    );
}
