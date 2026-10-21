import { useState, useEffect } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Cell as PieCell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesReport, setSalesReport] = useState(null);
  const [valuationReport, setValuationReport] = useState(null);
  const [turnoverReport, setTurnoverReport] = useState(null);
  const [filters, setFilters] = useState({
    sales: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], groupBy: 'day' },
    valuation: { valuationMethod: 'CURRENT_COST' },
    turnover: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
  });
  const [loading, setLoading] = useState(false);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/sales', { params: filters.sales });
      setSalesReport(res.data);
    } catch (err) {
      console.error('Failed to fetch sales report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValuationReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/inventory-valuation', { params: filters.valuation });
      setValuationReport(res.data);
    } catch (err) {
      console.error('Failed to fetch valuation report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTurnoverReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/turnover', { params: filters.turnover });
      setTurnoverReport(res.data);
    } catch (err) {
      console.error('Failed to fetch turnover report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesReport();
  }, [filters.sales]);

  useEffect(() => {
    fetchValuationReport();
  }, [filters.valuation]);

  useEffect(() => {
    fetchTurnoverReport();
  }, [filters.turnover]);

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
  const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Business analytics and inventory reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['sales', 'valuation', 'turnover', 'stock-movements', 'expiry-risk'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'sales' && (
            <SalesReportTab 
              report={salesReport} 
              loading={loading}
              filters={filters.sales}
              setFilters={(f) => setFilters({...filters, sales: f})}
              onFetch={fetchSalesReport}
            />
          )}
          {activeTab === 'valuation' && (
            <ValuationReportTab 
              report={valuationReport} 
              loading={loading}
              filters={filters.valuation}
              setFilters={(f) => setFilters({...filters, valuation: f})}
              onFetch={fetchValuationReport}
            />
          )}
          {activeTab === 'turnover' && (
            <TurnoverReportTab 
              report={turnoverReport} 
              loading={loading}
              filters={filters.turnover}
              setFilters={(f) => setFilters({...filters, turnover: f})}
              onFetch={fetchTurnoverReport}
            />
          )}
          {activeTab === 'stock-movements' && (
            <StockMovementsReportTab />
          )}
          {activeTab === 'expiry-risk' && (
            <ExpiryRiskReportTab />
          )}
        </div>
      </div>
    </div>
  );
}

function SalesReportTab({ report, loading, filters, setFilters, onFetch }) {
  const handleSubmit = (e) => { e.preventDefault(); onFetch(); };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="label">Start Date</label>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="input" />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="input" />
        </div>
        <div>
          <label className="label">Group By</label>
          <select value={filters.groupBy} onChange={(e) => setFilters({...filters, groupBy: e.target.value})} className="input">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">Generate</button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : report && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard title="Total Revenue" value={formatCurrency(report.totals?.totalRevenue)} />
            <SummaryCard title="Total Orders" value={formatNumber(report.totals?.totalOrders)} />
            <SummaryCard title="Total Units" value={formatNumber(report.totals?.totalUnits)} />
            <SummaryCard title="Avg Order Value" value={formatCurrency(report.totals?.avgOrderValue)} />
          </div>

          {/* Chart */}
          {report.data?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => '$' + (v/1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Products */}
          {report.totals?.topProducts?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Top Products</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.totals.topProducts.slice(0, 5).reverse()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="product" tick={{ fontSize: 12, fill: '#6b7280' }} width={120} />
                    <Tooltip formatter={(v) => [formatNumber(v), 'Units']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                      {report.totals.topProducts.slice(0, 5).reverse().map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ValuationReportTab({ report, loading, filters, setFilters, onFetch }) {
  const handleSubmit = (e) => { e.preventDefault(); onFetch(); };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Valuation Method</label>
          <select value={filters.valuationMethod} onChange={(e) => setFilters({...filters, valuationMethod: e.target.value})} className="input">
            <option value="CURRENT_COST">Current Cost</option>
            <option value="WEIGHTED_AVERAGE">Weighted Average</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">Generate</button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : report && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Inventory Valuation</h3>
              <span className="text-sm text-gray-500">Method: {report.valuationMethod}</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(report.totalValue)}</p>
            <p className="text-sm text-gray-500 mt-1">{report.itemCount} products in stock</p>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Valuation by Product</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>On Hand</th>
                    <th>Unit Cost</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-sm">{item.sku}</td>
                      <td>{item.name}</td>
                      <td>{item.category || '-'}</td>
                      <td>{item.onHand}</td>
                      <td>{formatCurrency(item.unitCost)}</td>
                      <td className="font-medium">{formatCurrency(item.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TurnoverReportTab({ report, loading, filters, setFilters, onFetch }) {
  const handleSubmit = (e) => { e.preventDefault(); onFetch(); };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Start Date</label>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="input" />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="input" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">Generate</button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard title="COGS" value={formatCurrency(report.cogs)} />
            <SummaryCard title="Avg Inventory Value" value={formatCurrency(report.avgInventoryValue)} />
            <SummaryCard title="Turnover Ratio" value={report.turnoverRatio?.toFixed(2) || '0'} />
            <SummaryCard title="Period" value={`${new Date(report.period.startDate).toLocaleDateString()} - ${new Date(report.period.endDate).toLocaleDateString()}`} />
          </div>

          {report.byProduct?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Turnover by Product</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units Sold</th>
                      <th>Revenue</th>
                      <th>COGS</th>
                      <th>Gross Margin</th>
                      <th>Turnover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byProduct.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-medium">{item.product?.name}</td>
                        <td>{formatNumber(item.unitsSold)}</td>
                        <td>{formatCurrency(item.revenue)}</td>
                        <td>{formatCurrency(item.cogs)}</td>
                        <td>{(item.grossMargin * 100).toFixed(1)}%</td>
                        <td>{item.turnover?.toFixed(2) || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StockMovementsReportTab() {
  return <div className="text-center py-12 text-gray-500"><p>Stock Movements Report - to be implemented</p></div>;
}

function ExpiryRiskReportTab() {
  return <div className="text-center py-12 text-gray-500"><p>Expiry Risk Report - to be implemented</p></div>;
}

function SummaryCard({ title, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);