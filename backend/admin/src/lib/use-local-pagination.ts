import { computed, reactive, toValue, watchEffect } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { PaginationProps } from "@pureadmin/table";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [20, 40, 80];

/** Client-side paging for APIs that return the complete collection. */
export function useLocalPagination<T>(items: MaybeRefOrGetter<readonly T[]>) {
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    pageSizes: PAGE_SIZES,
    currentPage: 1,
    background: true
  });

  const pageItems = computed(() => {
    const rows = toValue(items);
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  });

  watchEffect(() => {
    const total = toValue(items).length;
    pagination.total = total;
    const lastPage = Math.max(1, Math.ceil(total / pagination.pageSize));
    if (pagination.currentPage > lastPage) pagination.currentPage = lastPage;
  });

  function resetPage() {
    pagination.currentPage = 1;
  }

  function handlePageSizeChange(pageSize?: number) {
    if (pageSize) pagination.pageSize = pageSize;
    resetPage();
  }

  return {
    pagination,
    pageItems,
    showPagination: computed(() => pagination.total > DEFAULT_PAGE_SIZE),
    resetPage,
    handlePageSizeChange
  };
}
