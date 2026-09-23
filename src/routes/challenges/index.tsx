import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChallengeIndex } from '@/components/learn/ChallengeIndex';

export const Route = createFileRoute('/challenges/')({
  beforeLoad: ({ context }) => {
    if (context.seoPath.endsWith('/challenges') === false) throw notFound();
  },
  component: Page,
});

function Page() {
  return <ChallengeIndex />;
}
