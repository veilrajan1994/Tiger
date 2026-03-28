import React, { useState, useCallback, useRef, memo } from 'react';
import api from '../services/api';
import './Upload.css';

interface UploadResult {
  uploadId: string;
  status: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors?: any[];
}

interface ValidationIssue {
  row: number;
  column: string;
  issue: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  issues: ValidationIssue[];
  summary: string;
}

// ─── Requirements Card ───────────────────────────────────────────────────────

const RequirementsCard = memo(() => (
  <div className="requirements-card">
    <h3>Required CSV Columns</h3>
    <div className="requirements-columns">
      {['Store ID', 'SKU', 'Product Name', 'Price', 'Date (YYYY-MM-DD)'].map((col) => (
        <div className="req-item" key={col}>
          <span className="req-dot" />
          {col}
        </div>
      ))}
    </div>
    <div className="req-note">Maximum file size: 10MB. Only .csv files accepted.</div>
  </div>
));
RequirementsCard.displayName = 'RequirementsCard';

// ─── Results Card ────────────────────────────────────────────────────────────

interface ResultsCardProps {
  result: UploadResult;
}

const ResultsCard = memo<ResultsCardProps>(({ result }) => {
  const statusClass = result.status.toLowerCase();

  return (
    <div className="results-card">
      <div className="results-header">
        <h3>Upload Results</h3>
        <span className={`status-badge ${statusClass}`}>{result.status}</span>
      </div>

      <div className="results-stats">
        <div className="stat-item">
          <div className="stat-value total">{result.totalRecords}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-item">
          <div className="stat-value success">{result.successCount}</div>
          <div className="stat-label">Successful</div>
        </div>
        <div className="stat-item">
          <div className="stat-value errors">{result.errorCount}</div>
          <div className="stat-label">Errors</div>
        </div>
      </div>

      {result.errors && result.errors.length > 0 && (
        <div className="error-details">
          <h4>Error Details</h4>
          <ul className="error-list">
            {result.errors.slice(0, 10).map((err, i) => (
              <li key={i}>
                {err.row && <strong>Row {err.row}: </strong>}
                {err.batch && <strong>Batch {err.batch}: </strong>}
                {err.error}
              </li>
            ))}
          </ul>
          {result.errors.length > 10 && (
            <div className="error-more">
              ...and {result.errors.length - 10} more errors
            </div>
          )}
        </div>
      )}
    </div>
  );
});
ResultsCard.displayName = 'ResultsCard';

// ─── Main Component ──────────────────────────────────────────────────────────

const Upload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const validateFile = useCallback((selectedFile: File): boolean => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return false;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return false;
    }
    return true;
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      setError('');
      setResult(null);
      setValidation(null);
    }
  }, [validateFile]);

  // Parse CSV text into rows for AI validation
  const parseCSVForValidation = useCallback((text: string): Array<Record<string, string>> => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  }, []);

  const handleAIValidation = useCallback(async () => {
    if (!file) return;
    setValidating(true);
    setError('');
    setValidation(null);
    try {
      const text = await file.text();
      const rows = parseCSVForValidation(text);
      if (rows.length === 0) {
        setError('CSV file appears to be empty or has no data rows');
        setValidating(false);
        return;
      }
      const res = await api.post('/ai/validate-csv', { rows });
      setValidation(res.data.data.validation);
    } catch (err: any) {
      setError(err.response?.data?.message || 'AI validation failed');
    } finally {
      setValidating(false);
    }
  }, [file, parseCSVForValidation]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setResult(null);
    setValidation(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearError = useCallback(() => setError(''), []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await api.post('/upload/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadId = uploadResponse.data.data.uploadId;

      const pollStatus = async () => {
        try {
          const statusResponse = await api.get(`/upload/${uploadId}/status`);
          const upload = statusResponse.data.data.upload;

          if (upload.status === 'PROCESSING') {
            setTimeout(pollStatus, 2000);
          } else {
            setResult({
              uploadId: upload.id,
              status: upload.status,
              totalRecords: upload.totalRecords,
              successCount: upload.successCount,
              errorCount: upload.errorCount,
              errors: upload.errors ? JSON.parse(upload.errors) : []
            });
            setUploading(false);
          }
        } catch {
          setError('Failed to check upload status');
          setUploading(false);
        }
      };

      pollStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
      setUploading(false);
    }
  }, [file]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return (
    <div className="upload-page">
      <h1>Upload CSV</h1>
      <div className="subtitle">Import pricing data from a CSV file</div>

      <RequirementsCard />

      {error && (
        <div className="upload-alert error">
          <span>{error}</span>
          <button className="alert-close" onClick={clearError}>&times;</button>
        </div>
      )}

      <div className="drop-zone-wrapper">
        <input
          ref={fileInputRef}
          accept=".csv"
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="csv-file-input"
        />

        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onClick={handleDropZoneClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Drop CSV file here or click to browse"
        >
          <svg className="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {file ? (
              <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="9 15 12 12 15 15" />
              </>
            ) : (
              <>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </>
            )}
          </svg>

          {file ? (
            <div className="drop-zone-text">
              File ready to upload
            </div>
          ) : (
            <>
              <div className="drop-zone-text">
                Drag & drop your CSV file here, or <strong>browse</strong>
              </div>
              <div className="drop-zone-hint">CSV files only, up to 10MB</div>
            </>
          )}
        </div>

        {file && (
          <div className="file-info">
            <div className="file-info-left">
              <div className="file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatFileSize(file.size)}</div>
              </div>
            </div>
            <button className="file-remove" onClick={handleRemoveFile} title="Remove file" aria-label="Remove file">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {uploading && (
          <div className="progress-section">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" />
            </div>
            <div className="progress-text">
              <div className="spinner" />
              Processing your file...
            </div>
          </div>
        )}

        <div className="upload-actions">
          <button
            className="upload-btn"
            onClick={handleAIValidation}
            disabled={!file || validating || uploading}
            style={{ background: '#7c3aed' }}
          >
            {validating ? 'Validating...' : 'AI Validate'}
          </button>
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      {validation && (
        <div className="results-card" style={{ borderLeft: `4px solid ${validation.isValid ? '#22c55e' : '#ef4444'}` }}>
          <div className="results-header">
            <h3>AI Validation Results</h3>
            <span className={`status-badge ${validation.isValid ? 'completed' : 'failed'}`}>
              {validation.isValid ? 'VALID' : 'ISSUES FOUND'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.75rem' }}>{validation.summary}</p>
          {validation.issues.length > 0 && (
            <div className="error-details">
              <h4>Issues ({validation.issues.length})</h4>
              <ul className="error-list">
                {validation.issues.slice(0, 15).map((issue, i) => (
                  <li key={i} style={{ color: issue.severity === 'error' ? '#dc2626' : '#d97706' }}>
                    <strong>Row {issue.row}, {issue.column}:</strong> {issue.issue}
                    {issue.suggestion && <span style={{ color: '#6b7280' }}> — {issue.suggestion}</span>}
                  </li>
                ))}
              </ul>
              {validation.issues.length > 15 && (
                <div className="error-more">...and {validation.issues.length - 15} more issues</div>
              )}
            </div>
          )}
        </div>
      )}

      {result && <ResultsCard result={result} />}
    </div>
  );
};

export default Upload;
