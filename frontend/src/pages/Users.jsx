import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'SALES_STAFF' });
  const [editingUser, setEditingUser] = useState(null);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', status: 'ACTIVE' });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', { params: { page: pagination.page, limit: pagination.limit } });
      setUsers(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/users', formData);
      setShowCreateModal(false);
      setFormData({ name: '', email: '', password: '', role: 'SALES_STAFF' });
      fetchUsers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user account');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      await api.patch(`/users/${editingUser.id}`, editForm);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update user account');
    }
  };

  const toggleStatus = async (user) => {
    if (!confirm(`Are you sure you want to ${user.status === 'ACTIVE' ? 'deactivate' : 'activate'} this user?`)) return;
    try {
      await api.patch(`/users/${user.id}`, { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const startEdit = (user) => {
    setEditError('');
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, status: user.status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage system users and permissions</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th className="w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge-red' : user.role === 'MANAGER' ? 'badge-blue' : user.role === 'SALES_STAFF' ? 'badge-green' : 'badge-gray'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                        <button onClick={() => toggleStatus(user)} className={`text-sm font-medium ${user.status === 'ACTIVE' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                          {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create User</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {createError}
                </div>
              )}
              <div>
                <label className="label">Name *</label>
                <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required minLength={8} className="input" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} required className="input">
                  <option value="ADMIN">Administrator</option>
                  <option value="MANAGER">Store Manager</option>
                  <option value="SALES_STAFF">Sales Staff</option>
                  <option value="INVENTORY_STAFF">Inventory Staff</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {editError}
                </div>
              )}
              <div>
                <label className="label">Name *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} required className="input">
                  <option value="ADMIN">Administrator</option>
                  <option value="MANAGER">Store Manager</option>
                  <option value="SALES_STAFF">Sales Staff</option>
                  <option value="INVENTORY_STAFF">Inventory Staff</option>
                </select>
              </div>
              <div>
                <label className="label">Status *</label>
                <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})} required className="input">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}