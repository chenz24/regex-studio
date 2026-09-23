import { createFileRoute, notFound } from '@tanstack/react-router';
import { LessonPage } from '@/components/learn/LessonPage';

export const Route = createFileRoute('/learn/$lessonId')({
  beforeLoad: ({ context }) => {
    if (context.publicPage?.kind !== 'lesson') throw notFound();
  },
  component: Page,
});

function Page() {
  const { lessonId } = Route.useParams();
  return <LessonPage id={lessonId} />;
}
