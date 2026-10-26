import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  
  const [form, setForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    unitOfMeasure: 'EA',
  });

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [productRes, categoriesRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get('/categories', { params: { limit: 100 } }),
      ]);

      const prod = productRes.data.product;
      setForm({
        sku: prod.sku || '',
        barcode: prod.barcode || '',
        name: prod.name || '',
        description: prod.description || '',
        categoryId: prod.categoryId || '',
        costPrice: prod.costPrice !== undefined ? String(prod.costPrice) : '',
        sellingPrice: prod.sellingPrice !== undefined ? String(prod.sellingPrice) : '',
        unitOfMeasure: prod.unitOfMeasure || 'EA',
      });
      setCategories(categoriesRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim() ? form.barcode.trim() : null,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || null,
      costPrice: parseFloat(form.costPrice),
      sellingPrice: parseFloat(form.sellingPrice),
      unitOfMeasure: form.unitOfMeasure || 'EA',
    };

    try {
      await api.put(`/products/${id}`, payload);
      navigate(`/products/${id}`, { state: { updated: true } });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to update product';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/products/${id}`} className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to Product Details
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">SKU *</label>
              <input
                name="sku"
                type="text"
                required
                pattern="[A-Z0-9_-]+"
                value={form.sku}
                onChange={handleChange}
                className="input uppercase"
                placeholder="PROD-001"
              />
              <span className="text-xs text-gray-500">Uppercase letters, numbers, hyphens, underscores</span>
            </div>
            <div>
              <label className="label">Barcode</label>
              <input
                name="barcode"
                type="text"
                value={form.barcode}
                onChange={handleChange}
                className="input"
                placeholder="EAN/UPC Code"
              />
            </div>
          </div>

          <div>
            <label className="label">Product Name *</label>
            <input
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              className="input"
              placeholder="e.g. Organic Whole Milk 1L"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="input"
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Cost Price ($) *</label>
              <input
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.costPrice}
                onChange={handleChange}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Selling Price ($) *</label>
              <input
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.sellingPrice}
                onChange={handleChange}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Unit of Measure</label>
              <input
                name="unitOfMeasure"
                type="text"
                value={form.unitOfMeasure}
                onChange={handleChange}
                className="input"
                placeholder="EA, KG, LTR"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              className="input"
              placeholder="Detailed description of the product"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Link to={`/products/${id}`} className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving Changes...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
