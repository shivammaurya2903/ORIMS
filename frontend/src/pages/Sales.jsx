import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '', receiptNumber: '' });

  useEffect(() => {
    fetchSales();
  }, [pagination.page, filters]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/sales', { params });
      setSales(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
          <p className="text-gray-500">View and manage completed sales</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); fetchSales(); }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="input">
              <option value="">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <div>
            <label className="label">Receipt Number</label>
            <input type="text" value={filters.receiptNumber} onChange={(e) => setFilters({...filters, receiptNumber: e.target.value})} placeholder="RCP-..." className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Filter</button>
          </div>
        </form>
      </div>

      {/* Sales Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">No sales found</td></tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id}>
                    <td className="font-mono text-sm">{sale.receiptNumber}</td>
                    <td>{new Date(sale.createdAt).toLocaleString()}</td>
                    <td>{sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0}</td>
                    <td>{formatCurrency(sale.subtotal)}</td>
                    <td>{formatCurrency(sale.taxTotal)}</td>
                    <td className="font-medium">{formatCurrency(sale.total)}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>
                      <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : sale.status === 'REFUNDED' ? 'badge-yellow' : 'badge-gray'}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/sales/${sale.id}`} className="text-blue-600 hover:underline text-sm">View</Link>
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
    </div>
  );
}