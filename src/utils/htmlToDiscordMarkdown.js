/**
 * Convertit un fragment HTML collé (Word, Discord, navigateur) en Markdown
 * utilisable dans la description d'un embed Discord.
 */

function normalizeWhitespace(s) {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapBold(s) {
  if (!s.trim()) return '';
  const m = s.match(/^\*([^*]+)\*$/);
  if (m) return `***${m[1]}***`;
  return `**${s}**`;
}

function wrapItalic(s) {
  if (!s.trim()) return '';
  const m = s.match(/^\*\*([^*]+)\*\*$/);
  if (m) return `***${m[1]}***`;
  return `*${s}*`;
}

function wrapUnderline(s) {
  if (!s.trim()) return '';
  return `__${s}__`;
}

function wrapStrike(s) {
  if (!s.trim()) return '';
  return `~~${s}~~`;
}

function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();

  if (tag === 'br') return '\n';

  const inner = () => Array.from(node.childNodes).map(nodeToMarkdown).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return wrapBold(inner());
    case 'em':
    case 'i':
      return wrapItalic(inner());
    case 'u':
      return wrapUnderline(inner());
    case 'del':
    case 's':
    case 'strike':
      return wrapStrike(inner());
    case 'code':
      return '`' + inner().replace(/`/g, '\\`') + '`';
    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = inner();
      if (!href) return text;
      return `[${text}](${href})`;
    }
    case 'p':
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'center':
    case 'main': {
      const content = inner();
      if (!content.trim()) return '';
      return content + (content.endsWith('\n') ? '' : '\n');
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return `**${inner().trim()}**\n\n`;
    case 'blockquote':
      return (
        inner()
          .split('\n')
          .map((line) => (line.trim() ? `> ${line}` : '>'))
          .join('\n') + '\n'
      );
    case 'ol': {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      return items
        .map((li, i) => {
          const body = Array.from(li.childNodes).map(nodeToMarkdown).join('').trim();
          return `${i + 1}. ${body}\n`;
        })
        .join('');
    }
    case 'ul': {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      return items
        .map((li) => {
          const body = Array.from(li.childNodes).map(nodeToMarkdown).join('').trim();
          return `• ${body}\n`;
        })
        .join('');
    }
    case 'li': {
      return inner();
    }
    case 'span': {
      const fw = node.style?.fontWeight;
      const fs = node.style?.fontStyle;
      const td = node.style?.textDecorationLine || node.style?.textDecoration || '';
      const bold = fw === 'bold' || (fw !== '' && fw !== 'normal' && parseInt(fw, 10) >= 600);
      const italic = fs === 'italic';
      const underline = td.includes('underline');
      let out = inner();
      if (!out.trim()) return '';
      if (underline) out = wrapUnderline(out);
      if (bold && italic) {
        out = `***${out}***`;
      } else {
        if (bold) out = wrapBold(out);
        if (italic) out = wrapItalic(out);
      }
      return out;
    }
    default:
      return inner();
  }
}

/**
 * @param {string} html
 * @returns {string}
 */
export function htmlToDiscordMarkdown(html) {
  if (!html || typeof html !== 'string') return '';
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  const wrapped = cleaned.includes('<') ? cleaned : `<div>${cleaned}</div>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body;
  const raw = Array.from(root.childNodes).map(nodeToMarkdown).join('');
  return normalizeWhitespace(raw);
}
