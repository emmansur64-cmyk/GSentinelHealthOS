import type { LucideIcon } from "lucide-react";

export function EmptyStateIllustrated({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
