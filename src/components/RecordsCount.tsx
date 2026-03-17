"use client";

type RecordsCountProps = {
  count: number;
  total: number;
  label?: string;
};

export function RecordsCount({
  count,
  total,
  label = "записей",
}: RecordsCountProps) {
  return (
    <div className="text-xs text-muted-foreground">
      Показано{" "}
      <strong>
        1 — {count}
      </strong>{" "}
      из
      <strong> {total}</strong> {label}
    </div>
  );
}
