import { createFileRoute, redirect, notFound } from '@tanstack/react-router';
import { isLocale, localizedPath } from '@/lib/i18n';

export const Route = createFileRoute('/$locale/patterns/email')({
  beforeLoad: ({ context, params }) => {
    if (!isLocale(params.locale) || params.locale === 'en') throw notFound();
    throw redirect({
      href: localizedPath('/learn/practical-email', context.locale),
      statusCode: 308,
    });
  },
});
