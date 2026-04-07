'use client';

import { useState, SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to sign up');
            }

            router.push('/login');
        } catch (error: unknown) {
            const errMssage = error instanceof Error ? error.message : 'Failed to sign up';
            setError(errMssage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-xl border shadow-sm">
                <div className="text-center">
                    <h2 className="text-xl font-bold">Create an account</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        Sign up to save your chat history and more
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="email">
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="password">
                            Password
                        </label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="confirm-password">
                            Confirm Password
                        </label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-950/20 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Signing up...' : 'Sign up'}
                    </Button>
                </form>

                <div className="text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/login" className="text-primary hover:underline">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
