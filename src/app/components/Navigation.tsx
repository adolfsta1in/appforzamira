'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type AccessLevel = 'full' | 'registry';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('registry');

  useEffect(() => {
    if (pathname === '/login') return;

    fetch('/api/auth/me')
      .then(response => (response.ok ? response.json() : null))
      .then(data => setAccessLevel(data?.level === 'full' ? 'full' : 'registry'))
      .catch(() => setAccessLevel('registry'));
  }, [pathname]);

  if (pathname === '/login') return null;

  const allLinks = [
    { href: '/', label: 'Новый сертификат' },
    { href: '/registry', label: 'Реестр' },
    { href: '/appendix', label: 'Приложения' },
    { href: '/settings', label: 'Настройки печати' },
  ];
  const links = accessLevel === 'registry'
    ? allLinks.filter(link => link.href === '/registry')
    : allLinks;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAccessLevel('registry');
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="bg-[#2E7D32] text-white shadow-md no-print">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between py-3">
          <h1 className="text-lg font-bold">
            Агентии Тоҷикстандарт
          </h1>
          <nav className="flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Выйти
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
