import { getPaginationRange } from "../lib/pagination";
import { Select } from "./ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";

const DEFAULT_LIMIT_OPTIONS = [10, 20, 50];

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
}

export function ListPagination({
  page,
  totalPages,
  total,
  limit,
  hasPrevious,
  hasNext,
  isFetching = false,
  onPageChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
}: ListPaginationProps) {
  if (total === 0) return null;

  const rangeStart = (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const pageNumbers = getPaginationRange(page, totalPages);

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Showing {rangeStart}-{rangeEnd} of {total}
        </p>
        <div className="flex items-center gap-2">
          <label
            htmlFor="rows-per-page"
            className="text-sm text-neutral-500 dark:text-neutral-400"
          >
            Rows per page
          </label>
          <Select
            id="rows-per-page"
            value={String(limit)}
            disabled={isFetching}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-9 min-w-[72px]"
          >
            {limitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {totalPages > 1 ? (
        <Pagination className="justify-start lg:mx-0 lg:w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={!hasPrevious || isFetching}
                onClick={() => onPageChange(page - 1)}
              />
            </PaginationItem>

            {pageNumbers.map((pageNumber, index) =>
              pageNumber === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    isActive={pageNumber === page}
                    disabled={isFetching}
                    onClick={() => onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                disabled={!hasNext || isFetching}
                onClick={() => onPageChange(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
