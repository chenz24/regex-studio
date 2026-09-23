import { createFileRoute, notFound } from '@tanstack/react-router';
import { LessonPage } from '@/components/learn/LessonPage';
import { isLocale } from '@/lib/i18n';

export const Route = createFileRoute('/$locale/learn/$lessonId')({
  beforeLoad: ({ context, params }) => {
    if (!isLocale(params.locale) || params.locale === 'en') throw notFound();
    if (context.publicPage?.kind !== 'lesson') throw notFound();
  },
  component: Page,
});

function Page() {
  const { lessonId } = Route.useParams();
  return <LessonPage id={lessonId} />;
}
