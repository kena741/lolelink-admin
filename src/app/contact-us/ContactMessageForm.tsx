'use client';

import { FormEvent, useMemo, useState } from 'react';

interface ContactMessageFormProps {
    defaultSubject: string;
}

export function ContactMessageForm({ defaultSubject }: ContactMessageFormProps) {
    const [name, setName] = useState('');
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const isSubmitDisabled = useMemo(() => {
        return isSending || !name.trim() || !emailOrPhone.trim() || !subject.trim() || !message.trim();
    }, [emailOrPhone, isSending, message, name, subject]);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSending(true);
        setStatusMessage('');
        try {
            const response = await fetch('/api/contact-messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    email: emailOrPhone.trim(),
                    subject: subject.trim(),
                    message: message.trim(),
                }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok)
                throw new Error(payload.error || 'Failed to send message');
            setName('');
            setEmailOrPhone('');
            setSubject(defaultSubject);
            setMessage('');
            setStatusMessage('Message sent successfully.');
        } catch (error: unknown) {
            const messageText = error instanceof Error ? error.message : 'Failed to send message';
            setStatusMessage(messageText);
        } finally {
            setIsSending(false);
        }
    }

    return (
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <input
                type="text"
                name="name"
                placeholder="Your name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-[44px] rounded-md border border-[#dadada] bg-white px-4 font-sans text-[14px] text-[#1b1b1b] placeholder:text-[#838383] focus:outline-none focus:ring-2 focus:ring-[#027a3b] focus:ring-offset-2"
            />
            <input
                type="text"
                name="email"
                placeholder="Your email or phone"
                autoComplete="email tel"
                value={emailOrPhone}
                onChange={(event) => setEmailOrPhone(event.target.value)}
                className="h-[44px] rounded-md border border-[#dadada] bg-white px-4 font-sans text-[14px] text-[#1b1b1b] placeholder:text-[#838383] focus:outline-none focus:ring-2 focus:ring-[#027a3b] focus:ring-offset-2"
            />
            <input
                type="text"
                name="subject"
                placeholder="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="h-[44px] rounded-md border border-[#dadada] bg-white px-4 font-sans text-[14px] text-[#1b1b1b] placeholder:text-[#838383] focus:outline-none focus:ring-2 focus:ring-[#027a3b] focus:ring-offset-2 md:col-span-2"
            />
            <textarea
                name="message"
                placeholder="How can we help?"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="rounded-md border border-[#dadada] bg-white px-4 py-3 font-sans text-[14px] text-[#1b1b1b] placeholder:text-[#838383] focus:outline-none focus:ring-2 focus:ring-[#027a3b] focus:ring-offset-2 md:col-span-2"
            />
            <button
                type="submit"
                disabled={isSubmitDisabled}
                className="h-[40px] rounded-md border border-[#027a3b] bg-[#027a3b] px-6 font-sans text-[14px] font-semibold text-white shadow-[0_4px_4px_rgba(0,0,0,0.15)] transition-colors hover:bg-[#015d2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
            >
                {isSending ? 'Sending...' : 'Send message'}
            </button>
            {statusMessage ? (
                <p className="text-[14px] font-medium text-[#1b1b1b] md:col-span-2">{statusMessage}</p>
            ) : null}
        </form>
    );
}
