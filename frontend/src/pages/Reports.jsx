import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatNumber } from '../utils/format';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesReport, setSalesReport] = useState(null);
  const [valuationReport, setValuationReport] = useState(null);
  const [turnoverReport, setTurnoverReport] = useState(null);
  const [stockMovementsReport, setStockMovementsReport] = useState(null);
  const [expiryRiskReport, setExpiryRiskReport] = useState(null);
  const [filters, setFilters] = useState({
    sales: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], groupBy: 'day' },
    valuation: { valuationMethod: 'CURRENT_COST' },
    turnover: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
    stockMovements: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
    expiryRisk: { daysAhead: 60 },
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async (endpoint, params, defaultFilename) => {
    try {
      setExporting(true);
      const res = await api.get(endpoint, {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', defaultFilename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

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

  const fetchStockMovementsReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/stock-movements', { params: filters.stockMovements });
      setStockMovementsReport(res.data);
    } catch (err) {
      console.error('Failed to fetch stock movements report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiryRiskReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/expiry-risk', { params: filters.expiryRisk });
      setExpiryRiskReport(res.data);
    } catch (err) {
      console.error('Failed to fetch expiry risk report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') fetchSalesReport();
  }, [filters.sales, activeTab]);

  useEffect(() => {
    if (activeTab === 'valuation') fetchValuationReport();
  }, [filters.valuation, activeTab]);

  useEffect(() => {
    if (activeTab === 'turnover') fetchTurnoverReport();
  }, [filters.turnover, activeTab]);

  useEffect(() => {
    if (activeTab === 'stock-movements') fetchStockMovementsReport();
  }, [filters.stockMovements, activeTab]);

  useEffect(() => {
    if (activeTab === 'expiry-risk') fetchExpiryRiskReport();
  }, [filters.expiryRisk, activeTab]);

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
              exporting={exporting}
              filters={filters.sales}
              setFilters={(f) => setFilters({...filters, sales: f})}
              onFetch={fetchSalesReport}
              onExport={() => handleExportCsv('/reports/sales', filters.sales, `sales-${filters.sales.startDate}-to-${filters.sales.endDate}.csv`)}
            />
          )}
          {activeTab === 'valuation' && (
            <ValuationReportTab 
              report={valuationReport} 
              loading={loading}
              exporting={exporting}
              filters={filters.valuation}
              setFilters={(f) => setFilters({...filters, valuation: f})}
              onFetch={fetchValuationReport}
              onExport={() => handleExportCsv('/reports/inventory-valuation', filters.valuation, `valuation-${filters.valuation.valuationMethod.toLowerCase()}.csv`)}
            />
          )}
          {activeTab === 'turnover' && (
            <TurnoverReportTab 
              report={turnoverReport} 
              loading={loading}
              exporting={exporting}
              filters={filters.turnover}
              setFilters={(f) => setFilters({...filters, turnover: f})}
              onFetch={fetchTurnoverReport}
              onExport={() => handleExportCsv('/reports/turnover', filters.turnover, `turnover-${filters.turnover.startDate}-to-${filters.turnover.endDate}.csv`)}
            />
          )}
          {activeTab === 'stock-movements' && (
            <StockMovementsReportTab 
              report={stockMovementsReport}
              loading={loading}
              exporting={exporting}
              filters={filters.stockMovements}
              setFilters={(f) => setFilters({...filters, stockMovements: f})}
              onFetch={fetchStockMovementsReport}
              onExport={() => handleExportCsv('/reports/stock-movements', filters.stockMovements, `movements-${filters.stockMovements.startDate}-to-${filters.stockMovements.endDate}.csv`)}
            />
          )}
          {activeTab === 'expiry-risk' && (
            <ExpiryRiskReportTab 
              report={expiryRiskReport}
              loading={loading}
              exporting={exporting}
              filters={filters.expiryRisk}
              setFilters={(f) => setFilters({...filters, expiryRisk: f})}
              onFetch={fetchExpiryRiskReport}
              onExport={() => handleExportCsv('/reports/expiry-risk', filters.expiryRisk, `expiry-risk-${filters.expiryRisk.daysAhead}d.csv`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SalesReportTab({ report, loading, exporting, filters, setFilters, onFetch, onExport }) {
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
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">Generate</button>
          <button type="button" onClick={onExport} disabled={exporting || loading} className="btn-secondary">Export CSV</button>
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

function ValuationReportTab({ report, loading, exporting, filters, setFilters, onFetch, onExport }) {
  const handleSubmit = (e) => { e.preventDefault(); onFetch(); };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Valuation Method</label>
          <select value={filters.valuationMethod} onChange={(e) => setFilters({...filters, valuationMethod: e.target.value})} className="input">
            <option value="CURRENT_COST">Current Cost (Catalog Replacement)</option>
            <option value="WEIGHTED_AVERAGE">Weighted Average (Acquisition History)</option>
          </select>
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">Generate</button>
          <button type="button" onClick={onExport} disabled={exporting || loading} className="btn-secondary">Export CSV</button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : report && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Inventory Valuation</h3>
              <span className="badge badge-blue">Method: {report.valuationMethod}</span>
            </div>
            {report.valuationBasisDescription && (
              <p className="text-sm text-gray-500 mb-4">{report.valuationBasisDescription}</p>
            )}
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(report.totalValue)}</p>
            <p className="text-sm text-gray-500 mt-1">{report.itemCount} products in stock</p>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Valuation by Product</h3>
              <button onClick={onExport} disabled={exporting} className="btn-secondary text-sm">Download CSV</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>On Hand</th>
                    <th>Unit Cost</th>
                    <th>Cost Basis</th>
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
                      <td>
                        <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {item.costBasis}
                        </span>
                      </td>
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

function TurnoverReportTab({ report, loading, exporting, filters, setFilters, onFetch, onExport }) {
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
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">Generate</button>
          <button type="button" onClick={onExport} disabled={exporting || loading} className="btn-secondary">Export CSV</button>
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

function StockMovementsReportTab({ report, loading, exporting, filters, setFilters, onFetch, onExport }) {
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
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button type="button" onClick={onExport} disabled={exporting || loading} className="btn-secondary">
            Export CSV
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : !report ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {report.summary && Object.entries(report.summary).map(([type, stats]) => (
              <div key={type} className="card p-4">
                <p className="text-xs font-medium text-gray-500 capitalize">{type.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{stats.count} records</p>
                <p className="text-xs text-blue-600 mt-0.5">{stats.totalQty} total units</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Movement Ledger Records</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Movement Type</th>
                    <th>Delta</th>
                    <th>Reference</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data?.length > 0 ? (
                    report.data.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.createdAt).toLocaleString()}</td>
                        <td className="font-medium">{m.product?.name}</td>
                        <td className="font-mono text-xs">{m.product?.sku}</td>
                        <td>
                          <span className={`badge ${m.quantityDelta > 0 ? 'badge-green' : 'badge-red'}`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className={`font-semibold ${m.quantityDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </td>
                        <td className="text-xs text-gray-500">{m.referenceType || '-'}: {m.referenceId || '-'}</td>
                        <td className="text-xs text-gray-600">{m.reason || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">No stock movements found in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiryRiskReportTab({ report, loading, exporting, filters, setFilters, onFetch, onExport }) {
  const handleSubmit = (e) => { e.preventDefault(); onFetch(); };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Expiry Horizon (Days Ahead)</label>
          <select value={filters.daysAhead} onChange={(e) => setFilters({...filters, daysAhead: Number(e.target.value)})} className="input">
            <option value={15}>Next 15 Days</option>
            <option value={30}>Next 30 Days</option>
            <option value={60}>Next 60 Days</option>
            <option value={90}>Next 90 Days</option>
          </select>
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Loading...' : 'Check Expiry Risk'}
          </button>
          <button type="button" onClick={onExport} disabled={exporting || loading} className="btn-secondary">
            Export CSV
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div></div>
      ) : !report ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard title="Batches at Risk" value={report.totalBatches} />
            <SummaryCard title="Total Value at Risk" value={formatCurrency(report.totalValueAtRisk)} />
          </div>

          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Batches Approaching Expiry</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batch #</th>
                    <th>Product</th>
                    <th>Expiry Date</th>
                    <th>Days Left</th>
                    <th>Quantity On Hand</th>
                    <th>Value at Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data?.length > 0 ? (
                    report.data.map((b, idx) => (
                      <tr key={idx}>
                        <td className="font-mono text-xs">{b.batchNumber}</td>
                        <td className="font-medium">{b.product?.name}</td>
                        <td>{new Date(b.expiryDate).toLocaleDateString()}</td>
                        <td className="font-semibold text-orange-600">{b.daysUntilExpiry} days</td>
                        <td>{b.quantityOnHand}</td>
                        <td>{formatCurrency(b.valueAtRisk)}</td>
                        <td>
                          <span className={`badge ${b.status === 'EXPIRED' ? 'badge-red' : 'badge-yellow'}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">No batches expiring within {filters.daysAhead} days</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}