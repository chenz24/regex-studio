import { useT } from '@/lib/i18n';

export function ExpectedMatches({ texts }: { texts?: string[] }) {
  const t = useT();
  if (!texts?.length) return null;
  return (
    <div className="mt-3 text-sm">
      <p className="font-medium">{t.content_expected_matches()}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {texts.map((text, index) => (
          <li key={index}>
            <code className="whitespace-pre-wrap break-all">{text}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
