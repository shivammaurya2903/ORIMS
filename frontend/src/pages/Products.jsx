import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', categoryId: '', active: '', sort: 'createdAt', order: 'desc' });
  const [categories, setCategories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [pagination.page, filters]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/products', { params });
      setProducts(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories', { params: { limit: 100 } });
      setCategories(res.data.data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.costPrice = parseFloat(data.costPrice);
    data.sellingPrice = parseFloat(data.sellingPrice);
    data.categoryId = data.categoryId || null;
    
    try {
      setCreating(true);
      await api.post('/products', data);
      setShowCreateModal(false);
      e.target.reset();
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create product');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your product catalogue</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchProducts(); }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              placeholder="Name, SKU, Barcode"
              className="input"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={filters.categoryId} onChange={(e) => setFilters({...filters, categoryId: e.target.value})} className="input">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={filters.active} onChange={(e) => setFilters({...filters, active: e.target.value})} className="input">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Name</th>
                <th>Category</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">No products found</td></tr>
              ) : (
                products.map(product => (
                  <tr key={product.id}>
                    <td className="font-mono text-sm">{product.sku}</td>
                    <td className="font-mono text-sm">{product.barcode || '-'}</td>
                    <td className="font-medium">{product.name}</td>
                    <td>{product.category?.name || '-'}</td>
                    <td>{formatCurrency(product.costPrice)}</td>
                    <td className="font-medium">{formatCurrency(product.sellingPrice)}</td>
                    <td>
                      <span className="text-sm">
                        {product.totalOnHand} on hand, {product.totalAvailable} available
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${product.active ? 'badge-green' : 'badge-gray'}`}>
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/products/${product.id}`} className="text-blue-600 hover:underline text-sm">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} products
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({...pagination, page: pagination.page - 1})}
                disabled={pagination.page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({...pagination, page: pagination.page + 1})}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create Product</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">SKU *</label>
                <input name="sku" type="text" required pattern="[A-Z0-9_-]+" className="input" placeholder="ELEC-001" />
              </div>
              <div>
                <label className="label">Barcode</label>
                <input name="barcode" type="text" className="input" placeholder="1234567890123" />
              </div>
              <div>
                <label className="label">Name *</label>
                <input name="name" type="text" required className="input" placeholder="Product Name" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" rows={3} className="input" placeholder="Product description" />
              </div>
              <div>
                <label className="label">Category</label>
                <select name="categoryId" className="input">
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cost Price *</label>
                  <input name="costPrice" type="number" step="0.01" min="0" required className="input" placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Selling Price *</label>
                  <input name="sellingPrice" type="number" step="0.01" min="0" required className="input" placeholder="0.00" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}