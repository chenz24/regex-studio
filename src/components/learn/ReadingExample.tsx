import type { ReadingExample as Example } from '@/tutorial/types';
import { encodeShare } from '@/lib/share';
import { localizedPath, useLocale, useT } from '@/lib/i18n';

export function ReadingExample({ example }: { example: Example }) {
  const t = useT();
  const locale = useLocale();
  const groups = Math.max(0, ...example.matches.map((match) => match.groups?.length ?? 0));
  const href = `${localizedPath('/', locale)}#s=${encodeShare({
    v: 3,
    e: 'javascript',
    p: example.pattern,
    f: example.flags,
    t: example.testText,
    tc: [],
    ...(example.replacement ? { r: example.replacement.template, sr: true } : {}),
  })}`;
  const codeStyle =
    'mt-2 whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 font-mono text-sm dark:bg-gray-950';
  return (
    <figure
      data-testid="reading-example"
      className="my-6 min-w-0 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <figcaption className="font-semibold">{t.reading_example()}</figcaption>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t.reading_engine()}</p>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-medium">{t.reading_pattern()}</dt>
          <dd>
            <pre className={codeStyle}>
              <code>
                /{example.pattern}/{example.flags}
              </code>
            </pre>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">{t.learn_input()}</dt>
          <dd>
            <pre className={codeStyle}>{example.testText}</pre>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">
            {t.reading_matches({ count: String(example.matches.length) })}
          </dt>
          <dd>
            {groups > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th scope="col" className="p-2">
                        {t.reading_whole_match()}
                      </th>
                      {Array.from({ length: groups }, (_, i) => (
                        <th scope="col" key={i} className="p-2">
                          {t.reading_group({ number: String(i + 1) })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {example.matches.map((match, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-2 font-mono">{match.text}</td>
                        {Array.from({ length: groups }, (_, j) => (
                          <td key={j} className="p-2 font-mono">
                            {match.groups?.[j] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : example.matches.length ? (
              <ol className="mt-2 list-decimal space-y-2 pl-6">
                {example.matches.map((match, i) => (
                  <li key={i}>
                    <code className="whitespace-pre-wrap break-all text-sm">{match.text}</code>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm">{t.reading_no_match()}</p>
            )}
          </dd>
        </div>
        {example.replacement && (
          <>
            <div>
              <dt className="text-sm font-medium">{t.reading_replacement()}</dt>
              <dd>
                <pre className={codeStyle}>{example.replacement.template}</pre>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">{t.reading_replaced()}</dt>
              <dd>
                <pre data-testid="reading-replacement" className={codeStyle}>
                  {example.replacement.result}
                </pre>
              </dd>
            </div>
          </>
        )}
      </dl>
      <a
        href={href}
        className="mt-5 inline-block text-sm font-medium text-teal-700 underline underline-offset-4 dark:text-teal-300"
      >
        {t.reading_try()} &rarr;
      </a>
    </figure>
  );
}
