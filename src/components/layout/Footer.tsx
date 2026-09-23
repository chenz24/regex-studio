import { Github, Heart } from 'lucide-react';
import { useLocation } from '@tanstack/react-router';
import { localizedPath, splitLocalePath, useLocale, useT } from '@/lib/i18n';

export function Footer() {
  const t = useT();
  const locale = useLocale();
  const { pathname } = useLocation();
  const { rest } = splitLocalePath(pathname);
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="mt-8 border-t border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
        <nav
          aria-label={t.learn_nav()}
          className="mb-8 border-b border-gray-200 pb-6 dark:border-gray-800"
        >
          <a
            href={localizedPath('/learn', locale)}
            className="font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            {t.learn_nav()} &rarr;
          </a>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <a href={localizedPath('/learn', locale)} className="hover:underline">
                {t.content_tutorials()}
              </a>
            </li>
            <li>
              <a href={localizedPath('/challenges', locale)} className="hover:underline">
                {t.content_challenges()}
              </a>
            </li>
          </ul>
        </nav>
        <nav
          aria-label={t.learn_language()}
          className="mb-6 flex gap-4 text-sm text-teal-700 dark:text-teal-300"
        >
          <a href={localizedPath(rest, 'en')} hrefLang="en" lang="en" className="hover:underline">
            English
          </a>
          <a
            href={localizedPath(rest, 'zh')}
            hrefLang="zh-CN"
            lang="zh-CN"
            className="hover:underline"
          >
            简体中文
          </a>
        </nav>
        {/* SEO copy */}
        <section aria-labelledby="footer-about" className="max-w-3xl">
          <h2
            id="footer-about"
            className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2"
          >
            {t.footer_about_heading()}
          </h2>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {t.footer_about_p1()}
          </p>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 mt-2">
            {t.footer_about_p2_prefix()}
            <code>g</code>, <code>i</code>, <code>m</code>, <code>s</code>, <code>u</code>
            {t.footer_about_p2_suffix()}
          </p>
        </section>

        {/* Link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8">
          <div>
            <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              {t.footer_col_features()}
            </h3>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li>{t.footer_feature_realtime()}</li>
              <li>{t.footer_feature_railroad()}</li>
              <li>{t.footer_feature_ast()}</li>
              <li>{t.footer_feature_capture()}</li>
              <li>{t.footer_feature_replace()}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              {t.footer_col_use_cases()}
            </h3>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li>{t.footer_use_case_validation()}</li>
              <li>{t.footer_use_case_logs()}</li>
              <li>{t.footer_use_case_form()}</li>
              <li>{t.footer_use_case_refactor()}</li>
              <li>{t.footer_use_case_learn()}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              {t.footer_col_resources()}
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {t.footer_resource_mdn()}
                </a>
              </li>
              <li>
                <a
                  href="https://www.regular-expressions.info/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {t.footer_resource_rei()}
                </a>
              </li>
              <li>
                <a
                  href="https://www.pcre.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {t.footer_resource_pcre()}
                </a>
              </li>
              <li>
                <a
                  href="https://docs.python.org/3/library/re.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {t.footer_resource_python_prefix()}
                  <code>re</code>
                  {t.footer_resource_python_suffix()}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              {t.footer_col_project()}
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/chenz24/regex-studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  {t.footer_project_github()}
                </a>
              </li>
              <li className="text-gray-600 dark:text-gray-400">{t.footer_project_client_side()}</li>
              <li className="text-gray-600 dark:text-gray-400">{t.footer_project_no_tracking()}</li>
              <li className="text-gray-600 dark:text-gray-400">{t.footer_project_oss()}</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {t.footer_copyright({ year: String(year) })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 inline-flex items-center gap-1.5">
            {t.footer_built_with_prefix()}
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            {t.footer_built_with_suffix()}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
