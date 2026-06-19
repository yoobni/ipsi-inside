"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  Bold,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImageAction } from "@/app/passages/upload-image";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** small=문항/선지 등 짧은 입력, default=지문 본문 */
  size?: "small" | "default";
  className?: string;
};

export function RichEditor({
  value,
  onChange,
  placeholder,
  size = "default",
  className,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // 빈 paragraph만 있을 때는 빈 문자열로 normalize (DB 절약)
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          size === "small" ? "min-h-[64px]" : "min-h-[160px]",
          "px-3 py-2",
        ),
      },
    },
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border bg-background",
          size === "small" ? "h-[88px]" : "h-[200px]",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-[color,box-shadow]",
        className,
      )}
    >
      <Toolbar editor={editor} size={size} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, size }: { editor: Editor; size: "small" | "default" }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadImageAction(fd);
      if (r.ok) {
        editor.chain().focus().setImage({ src: r.url, alt: file.name }).run();
      } else {
        setUploadError(r.message);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
      <Btn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="굵게"
      >
        <Bold className="size-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="기울임"
      >
        <Italic className="size-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="취소선"
      >
        <Strikethrough className="size-3.5" />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="불릿 리스트"
      >
        <List className="size-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="번호 리스트"
      >
        <ListOrdered className="size-3.5" />
      </Btn>
      {size === "default" && (
        <>
          <Sep />
          <Btn
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            label="인용"
          >
            <Quote className="size-3.5" />
          </Btn>
          <Btn
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            label="표 삽입"
          >
            <TableIcon className="size-3.5" />
          </Btn>
        </>
      )}
      <Sep />
      <Btn
        onClick={() => fileRef.current?.click()}
        label={uploadError ?? "이미지 업로드"}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
      </Btn>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="hidden"
      />
      {uploadError && (
        <span className="text-destructive ml-2 text-[10px]">
          {uploadError}
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          label="되돌리기"
          disabled={!editor.can().undo()}
        >
          <Undo2 className="size-3.5" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          label="다시 실행"
          disabled={!editor.can().redo()}
        >
          <Redo2 className="size-3.5" />
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}
