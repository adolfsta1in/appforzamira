'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || 'Не удалось войти');
      setLoading(false);
      return;
    }

    router.replace(data.level === 'full' ? '/' : '/registry');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-5 text-xl font-bold text-gray-800">Вход в программу</h1>

        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
          Пароль доступа
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoFocus
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-green-100"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full rounded-lg bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Проверка...' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
