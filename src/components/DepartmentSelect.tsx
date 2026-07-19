"use client";

interface Dept {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function DepartmentSelect({
  departments,
  value,
  onChange,
  className,
  allLabel = "-- Không chọn --",
}: {
  departments: Dept[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  allLabel?: string;
}) {
  const parents = departments.filter((d) => !d.parent_id);
  const childrenOf = (parentId: string) => departments.filter((d) => d.parent_id === parentId);
  const orphans = departments.filter((d) => d.parent_id && !departments.some((p) => p.id === d.parent_id));

  return (
    <select className={className ?? "input"} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {parents.map((parent) => {
        const children = childrenOf(parent.id);
        if (children.length === 0) {
          // Bộ phận không có nhóm con - vẫn cho chọn trực tiếp bộ phận cha
          return <option key={parent.id} value={parent.id}>{parent.name}</option>;
        }
        return (
          <optgroup key={parent.id} label={parent.name}>
            <option value={parent.id}>— {parent.name} (chung)</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        );
      })}
      {orphans.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
