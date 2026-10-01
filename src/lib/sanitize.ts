import sanitize from 'sanitize-html';

// Rich text from the CMS is sanitised on render (defence in depth — it is also sanitised on save).
export function sanitizeHtml(html: string) {
  return sanitize(html || '', {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'hr', 'img', 'figure', 'figcaption', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'iframe'],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'], img: ['src', 'alt', 'width', 'height', 'loading'], span: ['class'], td: ['colspan'], th: ['colspan'],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.tiktok.com', 'www.instagram.com'],
    transformTags: {
      a: (tag, attribs) => ({ tagName: 'a', attribs: { ...attribs, ...(attribs.href?.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } }),
      img: (tag, attribs) => ({ tagName: 'img', attribs: { ...attribs, loading: 'lazy' } }),
    },
  });
}
