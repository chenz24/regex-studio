import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChallengePage } from '@/components/learn/ChallengePage';
import { isLocale } from '@/lib/i18n';

export const Route = createFileRoute('/$locale/challenges/$challengeId')({
  beforeLoad: ({ context, params }) => {
    if (!isLocale(params.locale) || params.locale === 'en') throw notFound();
    if (context.publicPage?.kind !== 'challenge') throw notFound();
  },
  component: Page,
});

function Page() {
  const { challengeId } = Route.useParams();
  return <ChallengePage id={challengeId} />;
}
