import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ supplierId: '', status: '', startDate: '', endDate: '' });
  const [suppliers, setSuppliers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ supplierId: '', storeId: 'default-store', expectedDate: '', items: [{ productId: '', orderedQty: 1, unitCost: '', taxRate: 0, discount: 0 }] });
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchProducts();
  }, [pagination.page, filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/purchase-orders', { params });
      setOrders(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers', { params: { active: true, limit: 100 } });
      setSuppliers(res.data.data);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { active: true, limit: 100 } });
      setProducts(res.data.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const addItem = () => {
    setFormData(prev => ({ ...prev, items: [...prev.items, { productId: '', orderedQty: 1, unitCost: '', taxRate: 0, discount: 0 }] }));
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      expectedDate: formData.expectedDate || null,
      items: formData.items.map(item => ({ ...item, orderedQty: parseInt(item.orderedQty), unitCost: parseFloat(item.unitCost), taxRate: parseFloat(item.taxRate), discount: parseFloat(item.discount) })),
    };
    try {
      setCreating(true);
      await api.post('/purchase-orders', data);
      setShowCreateModal(false);
      setFormData({ supplierId: '', storeId: 'default-store', expectedDate: '', items: [{ productId: '', orderedQty: 1, unitCost: '', taxRate: 0, discount: 0 }] });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create purchase order');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
  const getStatusBadge = (status) => {
    const badges = { DRAFT: 'badge-gray', SUBMITTED: 'badge-blue', PARTIALLY_RECEIVED: 'badge-yellow', RECEIVED: 'badge-green', CANCELLED: 'badge-red' };
    return badges[status] || 'badge-gray';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500">Manage purchase orders and receiving</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Order
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchOrders(); }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Supplier</label>
            <select value={filters.supplierId} onChange={(e) => setFilters({...filters, supplierId: e.target.value})} className="input">
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="input">
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Expected</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No purchase orders found</td></tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td className="font-mono text-sm">{order.id.slice(0, 8)}...</td>
                    <td>{order.supplier?.name}</td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'Not set'}</td>
                    <td><span className={`badge ${getStatusBadge(order.status)}`}>{order.status}</span></td>
                    <td>{order.items?.length || 0}</td>
                    <td>{formatCurrency(order.items?.reduce((sum, item) => sum + Number(item.unitCost) * item.orderedQty, 0))}</td>
                    <td>
                      <Link to={`/purchase-orders/${order.id}`} className="text-blue-600 hover:underline text-sm">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagination({...pagination, page: pagination.page - 1})} disabled={pagination.page === 1} className="btn-secondary text-sm">Previous</button>
              <button onClick={() => setPagination({...pagination, page: pagination.page + 1})} disabled={pagination.page === pagination.totalPages} className="btn-secondary text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create Purchase Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Supplier *</label>
                  <select value={formData.supplierId} onChange={(e) => setFormData({...formData, supplierId: e.target.value})} required className="input">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Expected Date</label>
                  <input type="date" value={formData.expectedDate} onChange={(e) => setFormData({...formData, expectedDate: e.target.value})} className="input" />
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Order Items</h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className="md:col-span-2">
                        <label className="label">Product *</label>
                        <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} required className="input">
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Qty *</label>
                        <input type="number" min="1" value={item.orderedQty} onChange={(e) => updateItem(index, 'orderedQty', e.target.value)} required className="input" />
                      </div>
                      <div>
                        <label className="label">Unit Cost *</label>
                        <input type="number" step="0.01" min="0" value={item.unitCost} onChange={(e) => updateItem(index, 'unitCost', e.target.value)} required className="input" />
                      </div>
                      <div>
                        <label className="label">Tax Rate</label>
                        <input type="number" step="0.01" min="0" max="1" value={item.taxRate} onChange={(e) => updateItem(index, 'taxRate', e.target.value)} className="input" />
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={() => removeItem(index)} disabled={formData.items.length <= 1} className="text-red-600 hover:underline text-sm">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItem} className="mt-3 text-blue-600 hover:underline text-sm">+ Add Another Item</button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? 'Creating...' : 'Create Purchase Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}