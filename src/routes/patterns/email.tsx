import { createFileRoute, redirect, notFound } from '@tanstack/react-router';
import { isLocale, localizedPath } from '@/lib/i18n';

export const Route = createFileRoute('/patterns/email')({
  beforeLoad: ({ context }) => {
    if (!isLocale(context.locale)) throw notFound();
    throw redirect({
      href: localizedPath('/learn/practical-email', context.locale),
      statusCode: 308,
    });
  },
});
