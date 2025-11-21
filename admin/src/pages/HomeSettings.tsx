import { useEffect, useState } from 'react';
import api from '../lib/api';

type Img = { url: string; public_id: string } | null;

export function HomeSettings() {
  const [homeBackground, setHomeBackground] = useState<File | null>(null);
  const [homePoster, setHomePoster] = useState<File | null>(null);
  const [newsContent, setNewsContent] = useState<string>('');

  const [current, setCurrent] = useState<{ homeBackground?: Img; homePoster?: Img; newsItems?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSettings();
        setCurrent(res.data);
        const firstItem = Array.isArray(res.data?.newsItems) && res.data.newsItems.length
          ? (res.data.newsItems[0] || '')
          : '';
        setNewsContent(firstItem);
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings');
      }
    })();
  }, []);

  async function compressImage(file: File, maxW = 1800, maxH = 1800, quality = 0.82): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), type, type === 'image/png' ? undefined : quality));
    return blob;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      if (homeBackground) {
        const blob = await compressImage(homeBackground);
        form.append('homeBackground', new File([blob], homeBackground.name, { type: blob.type || 'image/jpeg' }));
      }
      if (homePoster) {
        const blob = await compressImage(homePoster);
        form.append('homePoster', new File([blob], homePoster.name, { type: blob.type || 'image/jpeg' }));
      }

      const trimmedNews = newsContent.trim();
      form.append('newsItems', JSON.stringify(trimmedNews ? [trimmedNews] : []));

      const res = await api.updateSettings(form);
      setCurrent(res.data);
      setHomeBackground(null);
      setHomePoster(null);
      const firstItem =
        Array.isArray(res.data?.newsItems) && res.data.newsItems.length
          ? (res.data.newsItems[0] || '')
          : '';
      setNewsContent(firstItem);
      setToast('Settings updated successfully');
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Home Settings</h2>
      {error && <div className="error">{error}</div>}
      {toast && <div className="card" style={{ borderColor: '#28a745' }}><strong>Success:</strong> <span>{toast}</span></div>}
      <form onSubmit={handleSubmit} className="form">
        <div className="card" style={{ padding: 16 }}>
          <label>Background image in Home page</label>
          <input type="file" accept="image/*" onChange={(e) => setHomeBackground(e.target.files?.[0] || null)} />
          {current?.homeBackground?.url && (
            <img src={current.homeBackground.url} alt="home bg" style={{ width: '100%', maxWidth: 420, height: 'auto', borderRadius: 10, marginTop: 10 }} />
          )}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <label>Poster in Home page</label>
          <input type="file" accept="image/*" onChange={(e) => setHomePoster(e.target.files?.[0] || null)} />
          {current?.homePoster?.url && (
            <img src={current.homePoster.url} alt="poster" style={{ width: '100%', maxWidth: 420, height: 'auto', borderRadius: 10, marginTop: 10 }} />
          )}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <label htmlFor="news-content" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
            News Ticker Content
          </label>
          <textarea
            id="news-content"
            value={newsContent}
            onChange={(e) => setNewsContent(e.target.value)}
            placeholder="Add a short announcement that will scroll on the storefront"
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Tip: Keep it brief (one sentence). Leave blank to hide the news strip.
          </p>
        </div>
        <button className="primary" type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {saving && <span className="spinner" style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </section>
  );
}


