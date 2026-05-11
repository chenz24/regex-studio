import type React from 'react';

/**
 * Minimal markdown-ish renderer for tutorial step bodies.
 * Supports: paragraphs, blank lines, `- ` lists, inline `code`, **bold**, *italic*.
 * Intentionally tiny — lesson authors get type-safety, not arbitrary HTML.
 */
export function MarkdownLite({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 my-2">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Paragraph: collect contiguous non-empty non-list lines.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('- ')) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed">
        {renderInline(para.join(' '))}
      </p>,
    );
  }

  return <div className="text-sm text-gray-700 dark:text-gray-300">{blocks}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Tokenize: `code`, **bold**, *italic*. Naive but adequate for our content.
  const tokens: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let key = 0;

  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[0.85em] font-mono text-teal-700 dark:text-teal-300"
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-semibold text-gray-900 dark:text-gray-100">
          {raw.slice(2, -2)}
        </strong>,
      );
    } else {
      tokens.push(
        <em key={key++} className="italic">
          {raw.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}
