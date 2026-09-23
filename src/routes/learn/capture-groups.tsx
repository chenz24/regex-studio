import { createFileRoute, redirect, notFound } from '@tanstack/react-router';
import { isLocale, localizedPath } from '@/lib/i18n';

export const Route = createFileRoute('/learn/capture-groups')({
  beforeLoad: ({ context }) => {
    if (!isLocale(context.locale)) throw notFound();
    throw redirect({
      href: localizedPath('/learn/groups-capturing', context.locale),
      statusCode: 308,
    });
  },
});
