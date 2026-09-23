import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChallengeIndex } from '@/components/learn/ChallengeIndex';
import { isLocale } from '@/lib/i18n';

export const Route = createFileRoute('/$locale/challenges/')({
  beforeLoad: ({ context, params }) => {
    if (!isLocale(params.locale) || params.locale === 'en') throw notFound();
    if (context.seoPath.endsWith('/challenges') === false) throw notFound();
  },
  component: Page,
});

function Page() {
  return <ChallengeIndex />;
}
