'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useState } from 'react';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, ImagePlus, Undo2, Redo2, Minus, Code2 } from 'lucide-react';
import { MediaPicker } from './client';
import { cn } from '@/lib/utils';

function B({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={on} aria-label={label} title={label} aria-pressed={active} className={cn('grid h-8 w-8 place-items-center hover:bg-panel', active && 'bg-panel text-primary')}>{children}</button>;
}

/** WYSIWYG editor for product descriptions, journal posts and CMS text. Emits HTML (sanitised on save and render). */
export function RichText({ name, defaultValue = '', onChange, minHeight = 220 }: { name?: string; defaultValue?: string; onChange?: (html: string) => void; minHeight?: number }) {
  const [html, setHtml] = useState(defaultValue);
  const [picker, setPicker] = useState(false);
  const [source, setSource] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({ openOnClick: false, autolink: true }), Image],
    content: defaultValue,
    editorProps: { attributes: { class: 'prose-hg focus:outline-none px-4 py-3', style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor: e }) => { const h = e.getHTML(); setHtml(h); onChange?.(h); },
  });
  return (
    <div className="border border-line bg-surface focus-within:border-primary">
      {editor && (
        <div className="flex flex-wrap gap-0.5 border-b border-line px-1 py-1">
          <B label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold size={15} /></B>
          <B label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic size={15} /></B>
          <B label="Heading" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 size={15} /></B>
          <B label="Subheading" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}><Heading3 size={15} /></B>
          <B label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}><List size={15} /></B>
          <B label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered size={15} /></B>
          <B label="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote size={15} /></B>
          <B label="Divider" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></B>
          <B label="Link" active={editor.isActive('link')} on={() => {
            const prev = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://');
            if (url === null) return;
            if (!url) editor.chain().focus().unsetLink().run(); else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}><Link2 size={15} /></B>
          <B label="Image" on={() => setPicker(true)}><ImagePlus size={15} /></B>
          <B label="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></B>
          <B label="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></B>
          <B label="HTML source" on={() => setSource((v) => !v)} active={source}><Code2 size={15} /></B>
        </div>
      )}
      {source ? (
        <textarea value={html} onChange={(e) => { setHtml(e.target.value); onChange?.(e.target.value); editor?.commands.setContent(e.target.value, { emitUpdate: false }); }} className="w-full bg-transparent px-4 py-3 font-mono text-[12px] outline-none" style={{ minHeight }} />
      ) : <EditorContent editor={editor} />}
      {name && <input type="hidden" name={name} value={html} />}
      <MediaPicker open={picker} onClose={() => setPicker(false)} kind="image" onPick={(m) => m[0] && editor?.chain().focus().setImage({ src: m[0].url, alt: m[0].alt }).run()} />
    </div>
  );
}
