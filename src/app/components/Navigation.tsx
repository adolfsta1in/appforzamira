'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Новый сертификат' },
    { href: '/registry', label: 'Реестр' },
    { href: '/appendix', label: 'Приложения' },
    { href: '/settings', label: 'Настройки печати' },
  ];

  return (
    <header className="bg-[#2E7D32] text-white shadow-md no-print">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between py-3">
          <h1 className="text-lg font-bold">
            Агентии Тоҷикстандарт
          </h1>
          <nav className="flex gap-1">
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
          </nav>
        </div>
      </div>
    </header>
  );
}
