import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { AssignmentTable } from './components/AssignmentTable';
import { UploadModal } from './components/UploadModal';
import { DeleteModal } from './components/DeleteModal';
import { RenameModal } from './components/RenameModal';
import { ViewCodeModal } from './components/ViewCodeModal';
import { ConfigError } from './components/ConfigError';
import { configStatus } from './lib/supabase';
import { getAssignments } from './lib/assignments';
import { Assignment } from './types/assignment';

export function App() {
  if (!configStatus.isConfigured) {
    return <ConfigError status={configStatus} />;
  }

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [renamingAssignment, setRenamingAssignment] = useState<Assignment | null>(null);
  const [viewingCodeAssignment, setViewingCodeAssignment] = useState<Assignment | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCatalogue = useCallback(
    async (currentPage: number, query: string, isAppend: boolean = false) => {
      try {
        if (isAppend) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);

        const result = await getAssignments({
          page: currentPage,
          pageSize: 25,
          searchQuery: query,
        });

        if (isAppend) {
          setAssignments((prev) => [...prev, ...result.assignments]);
        } else {
          setAssignments(result.assignments);
        }

        setTotalCount(result.totalCount);
        setFilteredCount(result.filteredCount);
        setHasMore(result.hasMore);
        setPage(result.page);
      } catch (err: unknown) {
        console.error('Error fetching catalogue:', err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to connect to Supabase. Check your connection.'
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchCatalogue(1, '');
  }, [fetchCatalogue]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchCatalogue(1, query, false);
    }, 250);
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    fetchCatalogue(page + 1, searchQuery, true);
  };

  const handleUploadSuccess = (newAssignment: Assignment) => {
    setAssignments((prev) => [newAssignment, ...prev.filter((a) => a.id !== newAssignment.id)]);
    setTotalCount((c) => c + 1);
    setFilteredCount((c) => c + 1);
  };

  const handleDeleteSuccess = (deletedId: number) => {
    setAssignments((prev) => prev.filter((a) => a.id !== deletedId));
    setTotalCount((c) => Math.max(0, c - 1));
    setFilteredCount((c) => Math.max(0, c - 1));
  };

  const handleRenameSuccess = (updated: Assignment) => {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Navbar */}
      <Navbar totalCount={totalCount} onOpenUpload={() => setIsUploadOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1">
        <AssignmentTable
          assignments={assignments}
          totalCount={totalCount}
          filteredCount={filteredCount}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onOpenDelete={(a) => setDeletingAssignment(a)}
          onOpenRename={(a) => setRenamingAssignment(a)}
          onOpenViewCode={(a) => setViewingCodeAssignment(a)}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          onRetry={() => fetchCatalogue(page, searchQuery, false)}
          errorMessage={errorMessage}
        />
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Delete Modal */}
      <DeleteModal
        assignment={deletingAssignment}
        isOpen={Boolean(deletingAssignment)}
        onClose={() => setDeletingAssignment(null)}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Rename Modal */}
      <RenameModal
        assignment={renamingAssignment}
        isOpen={Boolean(renamingAssignment)}
        onClose={() => setRenamingAssignment(null)}
        onRenameSuccess={handleRenameSuccess}
      />

      {/* View & Copy C Code Modal */}
      <ViewCodeModal
        assignment={viewingCodeAssignment}
        isOpen={Boolean(viewingCodeAssignment)}
        onClose={() => setViewingCodeAssignment(null)}
      />

      {/* Minimal Footer */}
      <footer className="py-3 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        Assignment Hub • Public assignment sharing platform
      </footer>
    </div>
  );
}

export default App;
