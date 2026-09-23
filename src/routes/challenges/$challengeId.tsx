import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChallengePage } from '@/components/learn/ChallengePage';

export const Route = createFileRoute('/challenges/$challengeId')({
  beforeLoad: ({ context }) => {
    if (context.publicPage?.kind !== 'challenge') throw notFound();
  },
  component: Page,
});

function Page() {
  const { challengeId } = Route.useParams();
  return <ChallengePage id={challengeId} />;
}
