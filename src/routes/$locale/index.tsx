import { createFileRoute, notFound } from '@tanstack/react-router';
import App from '@/App';
import { isLocale } from '@/lib/i18n';
import { baseLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/$locale/')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale) || params.locale === baseLocale) throw notFound();
  },
  component: HomePage,
});

function HomePage() {
  return <App />;
}
