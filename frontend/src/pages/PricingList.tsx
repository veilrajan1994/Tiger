import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './PricingList.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PricingRecord {
  id: string;
  sku: string;
  productName: string;
  price: number;
  date: string;
  store: {
    storeId: string;
    storeName: string;
    country: string;
  };
}

interface Store {
  id: string;
  storeId: string;
  storeName: string;
  country: string;
}

interface Filters {
  sku: string;
  productName: string;
  storeId: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  sku: '',
  productName: '',
  storeId: '',
  dateFrom: '',
  dateTo: ''
};

// ─── Memoized Sub-Components ─────────────────────────────────────────────────

interface AlertProps {
  type: 'error' | 'success';
  message: string;
  onClose: () => void;
}

const Alert = memo<AlertProps>(({ type, message, onClose }) => (
  <div className={`alert alert-${type}`}>
    <span>{message}</span>
    <button className="alert-close" onClick={onClose}>&times;</button>
  </div>
));
Alert.displayName = 'Alert';

// ─── Filter Panel ────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: Filters;
  isAdmin: boolean;
  stores: Store[];
  filtersOpen: boolean;
  activeFilterCount: number;
  onToggle: () => void;
  onFilterChange: (field: keyof Filters, value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

const FilterPanel = memo<FilterPanelProps>(({
  filters, isAdmin, stores, filtersOpen, activeFilterCount,
  onToggle, onFilterChange, onSearch, onClear
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  }, [onSearch]);

  return (
    <div className="filter-panel">
      <button
        className={`filter-toggle ${filtersOpen ? 'open' : ''}`}
        onClick={onToggle}
      >
        <span className="filter-toggle-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Search Filters
          {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
        </span>
        <svg className={`filter-chevron ${filtersOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {filtersOpen && (
        <div className="filter-body">
          <div className="filter-field">
            <label htmlFor="filter-sku">SKU</label>
            <input id="filter-sku" type="text" placeholder="e.g. SKU001"
              value={filters.sku} onChange={(e) => onFilterChange('sku', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="filter-field">
            <label htmlFor="filter-product">Product Name</label>
            <input id="filter-product" type="text" placeholder="Search products..."
              value={filters.productName} onChange={(e) => onFilterChange('productName', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          {isAdmin && (
            <div className="filter-field">
              <label htmlFor="filter-store">Store</label>
              <select id="filter-store" value={filters.storeId} onChange={(e) => onFilterChange('storeId', e.target.value)}>
                <option value="">All Stores</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.storeName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-field">
            <label htmlFor="filter-from">Date From</label>
            <input id="filter-from" type="date" value={filters.dateFrom} onChange={(e) => onFilterChange('dateFrom', e.target.value)} />
          </div>
          <div className="filter-field">
            <label htmlFor="filter-to">Date To</label>
            <input id="filter-to" type="date" value={filters.dateTo} onChange={(e) => onFilterChange('dateTo', e.target.value)} />
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={onSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search
            </button>
            {activeFilterCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={onClear} title="Clear all filters">Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
FilterPanel.displayName = 'FilterPanel';

// ─── Table Row ───────────────────────────────────────────────────────────────

interface PricingRowProps {
  record: PricingRecord;
  isAdmin: boolean;
  editingCell: { id: string; field: string } | null;
  editValue: string;
  onStartEdit: (id: string, field: string, value: string | number) => void;
  onEditValueChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

const PricingRow = memo<PricingRowProps>(({
  record, isAdmin, editingCell, editValue,
  onStartEdit, onEditValueChange, onSaveEdit, onCancelEdit, onDelete
}) => {
  const isEditingProductName = editingCell?.id === record.id && editingCell.field === 'productName';
  const isEditingPrice = editingCell?.id === record.id && editingCell.field === 'price';

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSaveEdit();
    if (e.key === 'Escape') onCancelEdit();
  }, [onSaveEdit, onCancelEdit]);

  const formattedDate = useMemo(
    () => new Date(record.date).toLocaleDateString(),
    [record.date]
  );

  const formattedPrice = useMemo(
    () => `$${Number(record.price).toFixed(2)}`,
    [record.price]
  );

  return (
    <tr>
      <td><span className="sku-chip">{record.sku}</span></td>
      <td>
        {isEditingProductName ? (
          <input className="edit-input" value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit} onKeyDown={handleEditKeyDown} autoFocus />
        ) : (
          <span className="editable-cell" onClick={() => onStartEdit(record.id, 'productName', record.productName)} title="Click to edit">
            {record.productName}
          </span>
        )}
      </td>
      <td>
        {isEditingPrice ? (
          <input className="edit-input" type="number" step="0.01" value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit} onKeyDown={handleEditKeyDown} autoFocus />
        ) : (
          <span className="editable-cell price-cell" onClick={() => onStartEdit(record.id, 'price', record.price)} title="Click to edit">
            {formattedPrice}
          </span>
        )}
      </td>
      <td>{formattedDate}</td>
      <td>{record.store?.storeName || '—'}</td>
      <td><span className="country-chip">{record.store?.country || '—'}</span></td>
      {isAdmin && (
        <td className="center">
          <button className="delete-btn" onClick={() => onDelete(record.id)} title="Delete record" aria-label="Delete record">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
});
PricingRow.displayName = 'PricingRow';

// ─── Delete Dialog ───────────────────────────────────────────────────────────

interface DeleteDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteDialog = memo<DeleteDialogProps>(({ onConfirm, onCancel }) => (
  <div className="dialog-overlay" onClick={onCancel}>
    <div className="dialog" onClick={(e) => e.stopPropagation()}>
      <h2>Delete Pricing Record</h2>
      <p>Are you sure you want to delete this pricing record? This action cannot be undone.</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
));
DeleteDialog.displayName = 'DeleteDialog';

// ─── Pagination ──────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  startRecord: number;
  endRecord: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination = memo<PaginationProps>(({
  page, pageSize, total, totalPages, startRecord, endRecord,
  onPageChange, onPageSizeChange
}) => {
  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number(e.target.value));
  }, [onPageSizeChange]);

  const handlePrev = useCallback(() => onPageChange(page - 1), [onPageChange, page]);
  const handleNext = useCallback(() => onPageChange(page + 1), [onPageChange, page]);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {startRecord}–{endRecord} of {total.toLocaleString()}
      </span>
      <div className="pagination-controls">
        <label htmlFor="page-size-select" style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Rows:</label>
        <select id="page-size-select" value={pageSize} onChange={handlePageSizeChange}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button className="page-btn" disabled={page <= 1} onClick={handlePrev}>← Prev</button>
        <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 600 }}>
          {page} / {totalPages || 1}
        </span>
        <button className="page-btn" disabled={page >= totalPages} onClick={handleNext}>Next →</button>
      </div>
    </div>
  );
});
Pagination.displayName = 'Pagination';

// ─── Main Component ──────────────────────────────────────────────────────────

const PricingList: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(EMPTY_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce filters — only update debouncedFilters 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters]);

  // AI Search state
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiParsedFilters, setAiParsedFilters] = useState<Record<string, any> | null>(null);
  const [aiMode, setAiMode] = useState(false);

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user?.role]);
  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const totalPages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize]);
  const startRecord = useMemo(() => (page - 1) * pageSize + 1, [page, pageSize]);
  const endRecord = useMemo(() => Math.min(page * pageSize, total), [page, pageSize, total]);

  const fetchRecords = useCallback(async () => {
    if (aiMode) return;
    setLoading(true);
    setError('');
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedFilters.sku) params.sku = debouncedFilters.sku;
      if (debouncedFilters.productName) params.productName = debouncedFilters.productName;
      if (debouncedFilters.storeId) params.storeId = debouncedFilters.storeId;
      if (debouncedFilters.dateFrom) params.dateFrom = debouncedFilters.dateFrom;
      if (debouncedFilters.dateTo) params.dateTo = debouncedFilters.dateTo;

      const response = await api.get('/pricing', { params });
      setRecords(response.data.data.records);
      setTotal(response.data.data.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedFilters, aiMode]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/stores').then((res) => setStores(res.data.data.stores)).catch(() => {});
    }
  }, [isAdmin]);

  // ─── Stable callbacks ──────────────────────────────────────────────────────

  const handleSearch = useCallback(() => setPage(1), []);
  const handleClearFilters = useCallback(() => { setFilters(EMPTY_FILTERS); setDebouncedFilters(EMPTY_FILTERS); setPage(1); }, []);
  const handleToggleFilters = useCallback(() => setFiltersOpen((prev) => !prev), []);
  const clearError = useCallback(() => setError(''), []);
  const clearSuccess = useCallback(() => setSuccess(''), []);

  const handleFilterChange = useCallback((field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleStartEdit = useCallback((id: string, field: string, currentValue: string | number) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  }, []);

  const handleEditValueChange = useCallback((value: string) => setEditValue(value), []);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;
    try {
      const payload: any = {};
      if (editingCell.field === 'price') {
        const num = parseFloat(editValue);
        if (isNaN(num) || num <= 0) {
          setError('Invalid price value');
          setEditingCell(null);
          setEditValue('');
          return;
        }
        payload.price = num;
      } else {
        payload.productName = editValue;
      }
      await api.put(`/pricing/${editingCell.id}`, payload);
      setSuccess('Record updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchRecords();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update record');
    }
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, fetchRecords]);

  const handleDeleteClick = useCallback((id: string) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!recordToDelete) return;
    try {
      await api.delete(`/pricing/${recordToDelete}`);
      setSuccess('Record deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchRecords();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  }, [recordToDelete, fetchRecords]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  }, []);

  const handlePageChange = useCallback((newPage: number) => setPage(newPage), []);
  const handlePageSizeChange = useCallback((size: number) => { setPageSize(size); setPage(1); }, []);

  // ─── AI Search ─────────────────────────────────────────────────────────────

  const handleAiSearch = useCallback(async () => {
    if (!aiQuery.trim()) return;
    setAiSearching(true);
    setError('');
    try {
      const response = await api.post('/ai/search', { query: aiQuery.trim() });
      const { records: aiRecords, total: aiTotal, parsedFilters } = response.data.data;
      setRecords(aiRecords);
      setTotal(aiTotal);
      setAiParsedFilters(parsedFilters);
      setAiMode(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'AI search failed');
    } finally {
      setAiSearching(false);
    }
  }, [aiQuery]);

  const handleAiKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAiSearch();
  }, [handleAiSearch]);

  const handleClearAiSearch = useCallback(() => {
    setAiQuery('');
    setAiParsedFilters(null);
    setAiMode(false);
    setFilters(EMPTY_FILTERS);
    setDebouncedFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const handleAiQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAiQuery(e.target.value);
  }, []);

  // ─── Memoized subtitle ────────────────────────────────────────────────────

  const subtitle = useMemo(
    () => isAdmin ? 'Manage pricing across all stores' : 'Manage pricing for your assigned store',
    [isAdmin]
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="pricing-page">
      {/* Header */}
      <div className="pricing-header">
        <div>
          <h1>Pricing Records</h1>
          <div className="subtitle">{subtitle}</div>
        </div>
        <span className="record-count-badge">{total.toLocaleString()} records</span>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onClose={clearError} />}
      {success && <Alert type="success" message={success} onClose={clearSuccess} />}

      {/* AI Search Bar */}
      <div className="ai-search-wrapper">
        <div className="ai-search-bar">
          <div className="ai-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2h-1l-1 7H9l-1-7H7a2 2 0 0 1-2-2v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Ask AI: e.g. &quot;Show me expensive laptops in New York store from last month&quot;"
            value={aiQuery}
            onChange={handleAiQueryChange}
            onKeyDown={handleAiKeyDown}
          />
          <button
            className="ai-search-btn"
            onClick={handleAiSearch}
            disabled={aiSearching || !aiQuery.trim()}
          >
            {aiSearching ? 'Searching...' : 'AI Search'}
          </button>
        </div>

        {aiMode && aiParsedFilters && (
          <div className="ai-parsed-info">
            <span>AI understood:</span>
            {Object.entries(aiParsedFilters).map(([key, value]) => (
              <span key={key} className="parsed-tag">{key}: {String(value)}</span>
            ))}
            <button className="ai-clear-btn" onClick={handleClearAiSearch}>
              Clear AI search
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        isAdmin={isAdmin}
        stores={stores}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        onToggle={handleToggleFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClearFilters}
      />

      {/* Table */}
      <div className="pricing-table-wrapper">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            Loading records...
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p>No pricing records found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="pricing-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Price</th>
                    <th>Date</th>
                    <th>Store</th>
                    <th>Country</th>
                    {isAdmin && <th className="center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <PricingRow
                      key={record.id}
                      record={record}
                      isAdmin={isAdmin}
                      editingCell={editingCell}
                      editValue={editValue}
                      onStartEdit={handleStartEdit}
                      onEditValueChange={handleEditValueChange}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              startRecord={startRecord}
              endRecord={endRecord}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>

      {/* Delete Dialog */}
      {deleteDialogOpen && (
        <DeleteDialog onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} />
      )}
    </div>
  );
};

export default PricingList;
