import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatNumber } from '../utils/format';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [activeProductsCount, setActiveProductsCount] = useState(0);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [expiringTotal, setExpiringTotal] = useState(0);
  const [salesTrend, setSalesTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [todaySalesRes, trendRes, activeProductsRes, lowStockRes, expiryRes, recentRes] = await Promise.all([
        api.get('/reports/sales', { params: { startDate: todayStr, endDate: todayStr } }),
        api.get('/reports/sales', { params: { startDate: thirtyDaysAgoStr, endDate: todayStr, groupBy: 'day' } }),
        api.get('/products', { params: { active: true, limit: 1 } }),
        api.get('/inventory', { params: { stockStatus: 'LOW_STOCK', limit: 5 } }),
        api.get('/optimization/expiry-risk', { params: { daysUntilExpiry: 30, limit: 5 } }),
        api.get('/sales', { params: { limit: 5, sort: 'createdAt', order: 'desc' } }),
      ]);
      
      setTodayRevenue(todaySalesRes.data.totals?.totalRevenue || 0);
      setSalesTrend(trendRes.data.data || []);
      setTopProducts(trendRes.data.totals?.topProducts || []);
      setActiveProductsCount(activeProductsRes.data.pagination?.total ?? 0);
      setLowStock(lowStockRes.data.data || []);
      setLowStockTotal(lowStockRes.data.pagination?.total ?? (lowStockRes.data.data?.length || 0));
      setExpiringSoon(expiryRes.data.data || []);
      setExpiringTotal(expiryRes.data.pagination?.total ?? (expiryRes.data.data?.length || 0));
      setRecentSales(recentRes.data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your store performance</p>
        </div>
        <Link to="/reports" className="btn-secondary">View All Reports</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Today's Sales" 
          value={formatCurrency(todayRevenue)} 
          statusText="Calendar day to date"
          statusPositive={todayRevenue > 0}
          icon={<SalesIcon />}
        />
        <KPICard 
          title="Active Products" 
          value={formatNumber(activeProductsCount)} 
          statusText="Active in catalogue"
          statusPositive={activeProductsCount > 0}
          icon={<ProductsIcon />}
        />
        <KPICard 
          title="Low Stock Items" 
          value={formatNumber(lowStockTotal)} 
          statusText={lowStockTotal > 0 ? `${lowStockTotal} items need reorder` : 'All items well-stocked'}
          statusPositive={lowStockTotal === 0}
          icon={<AlertIcon />}
        />
        <KPICard 
          title="Expiring Soon" 
          value={formatNumber(expiringTotal)} 
          statusText={expiringTotal > 0 ? `${expiringTotal} batches near expiry` : 'No upcoming expiries'}
          statusPositive={expiringTotal === 0}
          icon={<ClockIcon />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend (30 Days)</h2>
          {salesTrend.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={(value) => '₹' + (value >= 1000 ? (value/1000).toFixed(0) + 'k' : value)}
                  />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No sales data available</div>
          )}
        </div>

        {/* Top Products */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h2>
          {topProducts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.slice(0, 5).reverse()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="product" tick={{ fontSize: 12, fill: '#6b7280' }} width={100} />
                  <Tooltip formatter={(value) => [formatNumber(value), 'Units']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                    {topProducts.slice(0, 5).reverse().map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No product data available</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
            <Link to="/inventory?stockStatus=LOW_STOCK" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-200">
            {lowStock.length > 0 ? (
              lowStock.map(item => (
                <div key={item.productId} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-yellow">{item.status}</span>
                    <p className="text-sm text-gray-500 mt-1">Available: {item.available} / Safety: {item.safetyStock}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No low stock items</div>
            )}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Expiring Soon</h2>
            <Link to="/optimization" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-200">
            {expiringSoon.length > 0 ? (
              expiringSoon.map(batch => (
                <div key={batch.batch?.id || batch.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{batch.product?.name || 'Unknown Product'}</p>
                    <p className="text-sm text-gray-500">Batch: {batch.batch?.batchNumber || batch.batchNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${batch.riskLevel === 'EXPIRED' ? 'badge-red' : batch.riskLevel === 'CRITICAL' ? 'badge-yellow' : 'badge-blue'}`}>
                      {batch.riskLevel}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{batch.daysUntilExpiry} days left</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No expiring batches</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
          <Link to="/sales" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length > 0 ? (
                recentSales.map(sale => (
                  <tr key={sale.id}>
                    <td className="font-mono text-sm">{sale.receiptNumber}</td>
                    <td>{new Date(sale.createdAt).toLocaleString()}</td>
                    <td>{sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0}</td>
                    <td className="font-medium">{formatCurrency(sale.total)}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>
                      <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : 'badge-gray'}`}>
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No recent sales</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, statusText, statusPositive, delta, deltaPositive, vsText, icon }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-full text-blue-600">
          {icon}
        </div>
      </div>
      {(delta !== undefined || statusText) && (
        <div className="mt-4 flex items-center">
          {delta !== undefined ? (
            <>
              <span className={`text-sm font-medium ${deltaPositive ? 'text-green-600' : 'text-red-600'}`}>
                {deltaPositive ? '▲' : '▼'} {delta}
              </span>
              {vsText && <span className="ml-2 text-sm text-gray-500">{vsText}</span>}
            </>
          ) : (
            <span className={`text-sm font-medium ${statusPositive ? 'text-green-600' : 'text-amber-600'}`}>
              {statusText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SalesIcon() {
  return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;
}
function ProductsIcon() {
  return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function AlertIcon() {
  return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}
function ClockIcon() {
  return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}