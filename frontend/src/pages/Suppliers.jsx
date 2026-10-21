import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', active: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, [pagination.page, filters]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/suppliers', { params });
      setSuppliers(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      setCreating(true);
      await api.post('/suppliers', data);
      setShowCreateModal(false);
      e.target.reset();
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create supplier');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500">Manage your supplier relationships</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchSuppliers(); }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Search</label>
            <input type="text" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="Supplier name" className="input" />
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

      {/* Suppliers Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Products</th>
                <th>Orders</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No suppliers found</td></tr>
              ) : (
                suppliers.map(supplier => (
                  <tr key={supplier.id}>
                    <td className="font-medium">{supplier.name}</td>
                    <td>{supplier.email || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                    <td>{supplier._count?.supplierProducts || 0}</td>
                    <td>{supplier._count?.purchaseOrders || 0}</td>
                    <td>
                      <span className={`badge ${supplier.active ? 'badge-green' : 'badge-gray'}`}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/suppliers/${supplier.id}`} className="text-blue-600 hover:underline text-sm">View</Link>
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create Supplier</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="label">Name *</label><input name="name" type="text" required className="input" /></div>
              <div><label className="label">Email</label><input name="email" type="email" className="input" /></div>
              <div><label className="label">Phone</label><input name="phone" type="text" className="input" /></div>
              <div><label className="label">Address</label><textarea name="address" rows={2} className="input" /></div>
              <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? 'Creating...' : 'Create Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}