import { createFileRoute, redirect, notFound } from '@tanstack/react-router';
import { isLocale, localizedPath } from '@/lib/i18n';

export const Route = createFileRoute('/learn/greedy-vs-lazy')({
  beforeLoad: ({ context }) => {
    if (!isLocale(context.locale)) throw notFound();
    throw redirect({
      href: localizedPath('/learn/quantifiers-greedy', context.locale),
      statusCode: 308,
    });
  },
});
