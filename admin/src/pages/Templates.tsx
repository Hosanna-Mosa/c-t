import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';

type Template = {
  _id: string;
  name?: string;
  image: { url: string; public_id: string };
  createdAt: string;
  updatedAt: string;
};

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [createFile, setCreateFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.getTemplates();
        setTemplates(res.data);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFile) {
      setError('Please select an image to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const form = new FormData();
      form.append('image', createFile);
      const res = await api.createTemplate(form);
      setTemplates((prev) => [res.data, ...prev]);
      setCreateFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create template');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateImage = async (template: Template, file: File | null) => {
    if (!file) return;
    try {
      setUpdatingId(template._id);
      setError(null);
      const form = new FormData();
      form.append('image', file);
      const res = await api.updateTemplate(template._id, form);
      setTemplates((prev) =>
        prev.map((item) => (item._id === template._id ? res.data : item))
      );
    } catch (e: any) {
      setError(e.message || 'Failed to update template');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm('Delete this template?')) return;
    try {
      setDeletingId(template._id);
      setError(null);
      await api.deleteTemplate(template._id);
      setTemplates((prev) => prev.filter((item) => item._id !== template._id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const humanDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const recentTemplates = useMemo(() => templates.slice(0, 6), [templates]);

  if (loading) {
    return (
      <section>
        <h2>Templates</h2>
        <div className="loading">Loading templates...</div>
      </section>
    );
  }

  return (
    <section>
      <h2>Templates</h2>

      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={handleCreate}>
        <h3 style={{ marginTop: 0 }}>Add Template</h3>
        <p style={{ color: 'var(--muted)', marginTop: -4, marginBottom: 12 }}>
          Upload a design image to make it available for customers.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>Template Image *</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="primary"
            disabled={uploading || !createFile}
          >
            {uploading ? 'Uploading...' : 'Upload Template'}
          </button>
        </div>
      </form>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>No templates uploaded yet.</p>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>All Templates</h3>
            <p style={{ color: 'var(--muted)' }}>
              {templates.length} template{templates.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {templates.map((template) => (
              <article key={template._id} className="card">
                <div
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--panel)',
                    aspectRatio: '1 / 1',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={template.image?.url}
                    alt={template.name || 'Template'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {template.name || 'Template'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Added {humanDate(template.createdAt)}
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <label className="secondary" style={{ cursor: 'pointer' }}>
                    {updatingId === template._id ? 'Updating...' : 'Replace Image'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) =>
                        handleUpdateImage(template, e.target.files?.[0] ?? null)
                      }
                      disabled={updatingId === template._id}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDelete(template)}
                    disabled={deletingId === template._id}
                    style={{
                      background: 'var(--danger)',
                      border: 'none',
                      color: 'var(--bg)',
                      padding: '10px 16px',
                      borderRadius: 8,
                      cursor: deletingId === template._id ? 'wait' : 'pointer',
                      opacity: deletingId === template._id ? 0.7 : 1,
                    }}
                  >
                    {deletingId === template._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {recentTemplates.length > 0 && (
        <div className="card" style={{ marginTop: 32 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Recently Added</h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {recentTemplates.map((template) => (
              <span
                key={template._id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                {template.name || 'Template'} •{' '}
                {new Date(template.createdAt).toLocaleDateString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Templates;


