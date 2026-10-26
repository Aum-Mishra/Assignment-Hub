import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { UploadForm } from './components/UploadForm';
import { AssignmentList } from './components/AssignmentList';
import { Footer } from './components/Footer';
import { ConfigError } from './components/ConfigError';
import { configStatus } from './lib/supabase';
import { getAssignments } from './lib/assignments';
import { Assignment } from './types/assignment';

export function App() {
  // If Supabase credentials are missing, render friendly configuration screen
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

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch assignments from Supabase
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
          pageSize: 12,
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
        console.error('Error in fetchCatalogue:', err);
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to reach the Supabase database. Please check your connection.';
        setErrorMessage(msg);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchCatalogue(1, '');
  }, [fetchCatalogue]);

  // Handle live search with 300ms debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchCatalogue(1, query, false);
    }, 300);
  };

  // Load more pagination
  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    const nextPage = page + 1;
    fetchCatalogue(nextPage, searchQuery, true);
  };

  // Retry handler
  const handleRetry = () => {
    fetchCatalogue(page, searchQuery, false);
  };

  // When a new assignment is uploaded successfully:
  // Prepend it to the list, increment counts, clear search if active, and scroll into view.
  const handleUploadSuccess = (newAssignment: Assignment) => {
    setAssignments((prev) => {
      // Avoid duplicate if already in list
      const exists = prev.some((a) => a.id === newAssignment.id);
      if (exists) return prev;
      return [newAssignment, ...prev];
    });

    setTotalCount((prev) => prev + 1);
    setFilteredCount((prev) => prev + 1);

    // If there was an active search query, clear it so user sees their new assignment
    if (searchQuery.trim().length > 0) {
      setSearchQuery('');
      fetchCatalogue(1, '', false);
    }

    // Smooth scroll to the newly created assignment card
    setTimeout(() => {
      const cardEl = document.getElementById(`assignment-${newAssignment.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.classList.add('ring-4', 'ring-brand-500/40');
        setTimeout(() => {
          cardEl.classList.remove('ring-4', 'ring-brand-500/40');
        }, 3000);
      }
    }, 300);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header totalCount={totalCount} />
      <main className="flex-1">
        <Hero />
        <UploadForm onUploadSuccess={handleUploadSuccess} />
        <AssignmentList
          assignments={assignments}
          totalCount={totalCount}
          filteredCount={filteredCount}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          errorMessage={errorMessage}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRetry={handleRetry}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </main>
      <Footer />
    </div>
  );
}

export default App;
