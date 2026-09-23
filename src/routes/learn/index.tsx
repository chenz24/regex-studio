import { createFileRoute } from '@tanstack/react-router';
import { LearnIndex } from '@/components/learn/LearnIndex';

export const Route = createFileRoute('/learn/')({
  component: () => <LearnIndex />,
});
