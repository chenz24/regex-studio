import { createFileRoute, notFound } from '@tanstack/react-router';
import { LearnIndex } from '@/components/learn/LearnIndex';
import { isLocale } from '@/lib/i18n';
import { baseLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/$locale/learn/')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale) || params.locale === baseLocale) throw notFound();
  },
  component: () => <LearnIndex />,
});
