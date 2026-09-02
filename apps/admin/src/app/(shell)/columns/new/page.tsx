import { ColumnEditor } from "../column-editor";

export const dynamic = "force-dynamic";

export default function NewColumnPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">새 칼럼</h1>
      <ColumnEditor />
    </div>
  );
}
