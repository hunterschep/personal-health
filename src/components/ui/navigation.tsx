import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = Readonly<{
  label: string;
  href?: string;
}>;

export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="text-ink-soft flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-h-11 items-center gap-1">
              {index === 0 ? null : <span aria-hidden="true">/</span>}
              {item.href === undefined || current ? (
                <span
                  aria-current={current ? "page" : undefined}
                  className={cn(current && "text-ink font-semibold")}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-ink inline-flex min-h-11 items-center rounded-md px-1 underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type PageToken = number | "ellipsis-start" | "ellipsis-end";

export function paginationTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7)
    return Array.from({ length: Math.max(totalPages, 0) }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-start",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

export function Pagination({
  currentPage,
  totalPages,
  hrefForPage,
  label = "Pagination",
}: {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  const boundedPage = Math.min(Math.max(currentPage, 1), totalPages);
  const linkClass =
    "border-line hover:border-brand hover:bg-brand-soft grid size-11 place-items-center rounded-full border text-sm font-semibold transition";

  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {boundedPage === 1 ? (
            <span aria-disabled="true" className={cn(linkClass, "text-ink-soft opacity-45")}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="sr-only">Previous page</span>
            </span>
          ) : (
            <Link href={hrefForPage(boundedPage - 1)} className={linkClass}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="sr-only">Previous page</span>
            </Link>
          )}
        </li>
        {paginationTokens(boundedPage, totalPages).map((token) => (
          <li key={token}>
            {typeof token === "number" ? (
              <Link
                href={hrefForPage(token)}
                aria-current={token === boundedPage ? "page" : undefined}
                aria-label={`Page ${token}`}
                className={cn(
                  linkClass,
                  token === boundedPage && "border-brand bg-brand text-white",
                )}
              >
                {token}
              </Link>
            ) : (
              <span className="text-ink-soft grid size-11 place-items-center">
                <MoreHorizontal aria-hidden="true" className="size-4" />
                <span className="sr-only">More pages</span>
              </span>
            )}
          </li>
        ))}
        <li>
          {boundedPage === totalPages ? (
            <span aria-disabled="true" className={cn(linkClass, "text-ink-soft opacity-45")}>
              <ChevronRight aria-hidden="true" className="size-4" />
              <span className="sr-only">Next page</span>
            </span>
          ) : (
            <Link href={hrefForPage(boundedPage + 1)} className={linkClass}>
              <ChevronRight aria-hidden="true" className="size-4" />
              <span className="sr-only">Next page</span>
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}

export type DataTableColumn<Row> = Readonly<{
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  className?: string;
}>;

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = "No rows to show.",
}: {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="border-line overflow-x-auto rounded-xl border" data-purpose="bulk-entry">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-ink-soft">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn("px-4 py-3 font-semibold", column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-ink-soft px-4 py-8 text-center">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="bg-surface hover:bg-surface-muted/50">
                {columns.map((column) => (
                  <td key={column.id} className={cn("px-4 py-3 align-top", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
