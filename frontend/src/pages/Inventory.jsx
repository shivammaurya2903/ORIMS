import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', categoryId: '', stockStatus: '', sort: 'productName', order: 'asc' });
  const [categories, setCategories] = useState([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState(null);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    fetchInventory();
    fetchCategories();
  }, [pagination.page, filters]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/inventory', { params });
      setItems(res.data.data);
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

  const openAdjustmentModal = (item) => {
    setAdjustmentItem(item);
    setShowAdjustmentModal(true);
  };

  const handleAdjustment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      productId: adjustmentItem.productId,
      storeId: 'default-store',
      quantityDelta: parseInt(formData.get('quantityDelta')),
      reason: formData.get('reason'),
      movementType: formData.get('movementType'),
    };
    
    try {
      setAdjusting(true);
      await api.post('/inventory/adjustments', data);
      setShowAdjustmentModal(false);
      e.target.reset();
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">View and manage stock levels</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard title="Total Products" value={items.length} icon={<PackageIcon />} />
        <SummaryCard title="In Stock" value={items.filter(i => i.status === 'IN_STOCK').length} icon={<CheckIcon />} color="text-green-600" bg="bg-green-50" />
        <SummaryCard title="Low Stock" value={items.filter(i => i.status === 'LOW_STOCK').length} icon={<AlertIcon />} color="text-yellow-600" bg="bg-yellow-50" />
        <SummaryCard title="Out of Stock" value={items.filter(i => i.status === 'OUT_OF_STOCK').length} icon={<XIcon />} color="text-red-600" bg="bg-red-50" />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchInventory(); }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Search</label>
            <input type="text" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="Product name, SKU" className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={filters.categoryId} onChange={(e) => setFilters({...filters, categoryId: e.target.value})} className="input">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Stock Status</label>
            <select value={filters.stockStatus} onChange={(e) => setFilters({...filters, stockStatus: e.target.value})} className="input">
              <option value="">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="label">Sort By</label>
            <select value={filters.sort} onChange={(e) => setFilters({...filters, sort: e.target.value})} className="input">
              <option value="productName">Product Name</option>
              <option value="onHand">On Hand</option>
              <option value="available">Available</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Safety Stock</th>
                <th>Status</th>
                <th>Value</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-500">No inventory items found</td></tr>
              ) : (
                items.map(item => (
                  <tr key={item.productId}>
                    <td className="font-mono text-sm">{item.sku}</td>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.category?.name || '-'}</td>
                    <td>{item.onHand}</td>
                    <td>{item.reserved}</td>
                    <td className="font-medium text-blue-600">{item.available}</td>
                    <td>{item.safetyStock}</td>
                    <td>
                      <span className={`badge ${item.status === 'IN_STOCK' ? 'badge-green' : item.status === 'LOW_STOCK' ? 'badge-yellow' : 'badge-red'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{formatCurrency(item.inventoryValue)}</td>
                    <td>
                      <button onClick={() => openAdjustmentModal(item)} className="text-blue-600 hover:underline text-sm">Adjust</button>
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
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPagination({...pagination, page: pagination.page - 1})} disabled={pagination.page === 1} className="btn-secondary text-sm">Previous</button>
              <button onClick={() => setPagination({...pagination, page: pagination.page + 1})} disabled={pagination.page === pagination.totalPages} className="btn-secondary text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {showAdjustmentModal && adjustmentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Adjust Stock: {adjustmentItem.name}</h2>
              <button onClick={() => setShowAdjustmentModal(false)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleAdjustment} className="p-6 space-y-4">
              <div>
                <label className="label">Current Available: {adjustmentItem.available}</label>
              </div>
              <div>
                <label className="label">Adjustment Type</label>
                <select name="movementType" required className="input">
                  <option value="ADJUSTMENT_INCREASE">Increase Stock</option>
                  <option value="ADJUSTMENT_DECREASE">Decrease Stock</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="WASTAGE">Wastage</option>
                </select>
              </div>
              <div>
                <label className="label">Quantity Change *</label>
                <input name="quantityDelta" type="number" required className="input" placeholder="+10 or -5" />
              </div>
              <div>
                <label className="label">Reason *</label>
                <textarea name="reason" required rows={3} className="input" placeholder="Reason for adjustment" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={adjusting} className="btn-primary flex-1">{adjusting ? 'Adjusting...' : 'Apply Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon, color = 'text-blue-600', bg = 'bg-blue-50' }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${bg} ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function PackageIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>; }
function CheckIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>; }
function AlertIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>; }
function XIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>; }