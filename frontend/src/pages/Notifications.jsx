import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [pagination.page, filters]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/notifications', { params });
      setNotifications(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications', { params: { status: 'UNREAD', limit: 1 } });
      setUnreadCount(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => n.status === 'UNREAD' ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      LOW_STOCK: '📦',
      OUT_OF_STOCK: '🚫',
      EXPIRY_WARNING: '⚠️',
      EXPIRY_EXPIRED: '☠️',
      PURCHASE_ORDER_DUE: '📋',
      FORECAST_AVAILABLE: '📊',
    };
    return icons[type] || '🔔';
  };

  const getTypeColor = (type) => {
    const colors = {
      LOW_STOCK: 'text-yellow-600 bg-yellow-50',
      OUT_OF_STOCK: 'text-red-600 bg-red-50',
      EXPIRY_WARNING: 'text-orange-600 bg-orange-50',
      EXPIRY_EXPIRED: 'text-red-600 bg-red-50',
      PURCHASE_ORDER_DUE: 'text-blue-600 bg-blue-50',
      FORECAST_AVAILABLE: 'text-purple-600 bg-purple-50',
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">System alerts and notifications</p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn-primary">Mark All Read ({unreadCount})</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchNotifications(); }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="input">
              <option value="">All Status</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})} className="input">
              <option value="">All Types</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="EXPIRY_WARNING">Expiry Warning</option>
              <option value="EXPIRY_EXPIRED">Expired</option>
              <option value="PURCHASE_ORDER_DUE">PO Due</option>
              <option value="FORECAST_AVAILABLE">Forecast Available</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      {/* Notifications List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div></div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No notifications found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors ${notification.status === 'UNREAD' ? 'bg-blue-50' : ''}`}
              >
                <span className="text-2xl mt-1">{getTypeIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{notification.message}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(notification.type)}`}>
                      {notification.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                  {notification.product && (
                    <p className="text-sm text-gray-400 mt-1">Product: {notification.product.name} ({notification.product.sku})</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notification.status === 'UNREAD' && (
                    <button onClick={() => markAsRead(notification.id)} className="btn-secondary text-sm py-1 px-3">Mark Read</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
    </div>
  );
}