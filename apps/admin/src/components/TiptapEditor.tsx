'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { uploadArticleImage } from '@/app/actions/upload-actions'
import { clsx } from 'clsx'

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  minHeight?: string
  /** BCP-47 language of the content, set on the editable element (e.g. 'bn'). */
  lang?: string
  /** Accessible name of the editable region (match the visible section label). */
  ariaLabel?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-semibold transition-colors transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
        active
          ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div className="h-5 w-px bg-[var(--color-border)] mx-0.5" aria-hidden="true" />
  )
}

async function uploadAndInsert(editor: Editor, file: File, setError: (m: string | null) => void) {
  setError(null)
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await uploadArticleImage(fd)
    if ('error' in res) setError(res.error)
    else editor.chain().focus().setImage({ src: res.url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
  } catch {
    setError('Upload failed. Try again.')
  }
}

export function TiptapEditor({
  content,
  onChange,
  placeholder,
  minHeight = '200px',
  lang,
  ariaLabel,
}: TiptapEditorProps) {
  const editorRef = useRef<Editor | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
        if (!file || !editorRef.current) return false
        void uploadAndInsert(editorRef.current, file, setUploadError)
        return true
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'))
        if (!file || !editorRef.current) return false
        event.preventDefault()
        void uploadAndInsert(editorRef.current, file, setUploadError)
        return true
      },
      attributes: {
        ...(lang ? { lang } : {}),
        ...(ariaLabel ? { role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel } : {}),
        class: 'prose prose-sm max-w-none focus:outline-none text-[var(--color-text-primary)]',
      },
    },
  })

  editorRef.current = editor

  if (!editor) return null

  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-bg-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30 focus-within:border-[var(--color-primary)] transition-colors transition-shadow duration-200">
      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Text style */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span className="line-through text-xs">S</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <span className="font-mono text-xs">`</span>
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="2" cy="3.5" r="1.2" fill="currentColor" />
            <rect x="5" y="2.75" width="8" height="1.5" rx="0.75" fill="currentColor" />
            <circle cx="2" cy="7" r="1.2" fill="currentColor" />
            <rect x="5" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor" />
            <circle cx="2" cy="10.5" r="1.2" fill="currentColor" />
            <rect x="5" y="9.75" width="8" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered list"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <text x="0" y="4.5" fontSize="4.5" fill="currentColor">1.</text>
            <rect x="5" y="2.75" width="8" height="1.5" rx="0.75" fill="currentColor" />
            <text x="0" y="8.5" fontSize="4.5" fill="currentColor">2.</text>
            <rect x="5" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor" />
            <text x="0" y="12.5" fontSize="4.5" fill="currentColor">3.</text>
            <rect x="5" y="9.75" width="8" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="0" y="2" width="2" height="10" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="4" y="2" width="2" height="10" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="7" y="4" width="6" height="1.5" rx="0.75" fill="currentColor" />
            <rect x="7" y="7.5" width="5" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Image */}
        <ToolbarButton
          onClick={() => fileRef.current?.click()}
          active={false}
          title="Insert image"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="4.5" cy="5.5" r="1.1" fill="currentColor" />
            <path d="M1.5 11l3.5-3.5 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolbarButton>
        <input
          ref={fileRef}
          type="file"
          name="article-image"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          aria-label="Choose an image to insert"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void uploadAndInsert(editor, file, setUploadError)
          }}
        />

        <Divider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          active={false}
          title="Undo (Ctrl+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 4h5a3.5 3.5 0 010 7H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 2L2 4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          active={false}
          title="Redo (Ctrl+Y)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M12 4H7a3.5 3.5 0 000 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 2l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolbarButton>
      </div>

      <p role="alert" aria-live="polite" className={uploadError ? 'px-4 py-2 text-xs text-[var(--color-danger)] border-b border-[var(--color-border)]' : 'sr-only'}>
        {uploadError}
      </p>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        aria-label="Article content"
        className="px-4 py-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-[var(--color-primary)]/40 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-[var(--color-text-secondary)] [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_code]:bg-[var(--color-bg-secondary)] [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-xs [&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_.is-editor-empty]:before:text-[var(--color-text-muted)] [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0"
      />
    </div>
  )
}
