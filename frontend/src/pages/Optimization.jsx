import { useState, useEffect } from 'react';
import api from '../services/api';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const getRiskBadge = (risk) => {
  const badges = { HIGH: 'badge-red', MEDIUM: 'badge-yellow', LOW: 'badge-green' };
  return badges[risk] || 'badge-gray';
};

export default function Optimization() {
  const [recommendations, setRecommendations] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [slowMoving, setSlowMoving] = useState([]);
  const [expiryRisk, setExpiryRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [filters, setFilters] = useState({ status: '', riskLevel: '', categoryId: '' });
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [recalculating, setRecalculating] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    fetchRecommendations();
    fetchCategories();
    fetchSlowMoving();
    fetchExpiryRisk();
    fetchForecasts();
    fetchModelInfo();
  }, [pagination.page, filters, activeTab]);

  const fetchModelInfo = async () => {
    try {
      const res = await api.get('/optimization/model-info');
      setModelInfo(res.data);
    } catch (err) {
      console.warn('Failed to fetch model info', err);
    }
  };

  const fetchForecasts = async () => {
    try {
      const res = await api.get('/optimization/forecasts', { params: { limit: 50 } });
      setForecasts(res.data.data);
    } catch (err) {
      console.error('Failed to fetch forecasts', err);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await api.post('/optimization/recalculate');
      await Promise.all([
        fetchRecommendations(),
        fetchForecasts(),
        fetchModelInfo(),
        fetchSlowMoving(),
        fetchExpiryRisk(),
      ]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to recalculate');
    } finally {
      setRecalculating(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, ...filters };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const res = await api.get('/optimization/recommendations', { params });
      setRecommendations(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages }));
    } catch (err) {
      console.error('Failed to fetch recommendations', err);
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

  const fetchSlowMoving = async () => {
    try {
      const res = await api.get('/optimization/slow-moving', { params: { limit: 20 } });
      setSlowMoving(res.data.data);
    } catch (err) {
      console.error('Failed to fetch slow moving', err);
    }
  };

  const fetchExpiryRisk = async () => {
    try {
      const res = await api.get('/optimization/expiry-risk', { params: { limit: 20 } });
      setExpiryRisk(res.data.data);
    } catch (err) {
      console.error('Failed to fetch expiry risk', err);
    }
  };

  const handleApprove = async (id, approvedQty) => {
    try {
      await api.post(`/optimization/recommendations/${id}/approve`, { approvedQty, createPurchaseOrder: false });
      fetchRecommendations();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id, reason) => {
    if (!reason) return;
    try {
      await api.post(`/optimization/recommendations/${id}/reject`, { reason });
      fetchRecommendations();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Optimization Centre</h1>
          <p className="text-gray-500">Demand forecasts, reorder recommendations, and inventory insights</p>
        </div>
        <button onClick={handleRecalculate} disabled={recalculating} className="btn-secondary">
          {recalculating ? 'Recalculating...' : 'Recalculate Recommendations'}
        </button>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['recommendations', 'forecasts', 'slow-moving', 'expiry-risk'].map(tab => (
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
          {activeTab === 'recommendations' && (
            <RecommendationsTab 
              recommendations={recommendations} 
              loading={loading}
              pagination={pagination}
              setPagination={setPagination}
              filters={filters}
              setFilters={setFilters}
              categories={categories}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          {activeTab === 'slow-moving' && (
            <SlowMovingTab slowMoving={slowMoving} />
          )}
          {activeTab === 'expiry-risk' && (
            <ExpiryRiskTab expiryRisk={expiryRisk} />
          )}
          {activeTab === 'forecasts' && (
            <ForecastsTab forecasts={forecasts} modelInfo={modelInfo} />
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationsTab({ recommendations, loading, pagination, setPagination, filters, setFilters, categories, onApprove, onReject }) {
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);

  return (
    <div>
      {/* Filters */}
      <form onSubmit={(e) => { e.preventDefault(); setPagination({...pagination, page: 1}); }} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="label">Category</label>
          <select value={filters.categoryId} onChange={(e) => setFilters({...filters, categoryId: e.target.value})} className="input">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="input">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CONVERTED_TO_PO">Converted to PO</option>
          </select>
        </div>
        <div>
          <label className="label">Risk Level</label>
          <select value={filters.riskLevel} onChange={(e) => setFilters({...filters, riskLevel: e.target.value})} className="input">
            <option value="">All Risks</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </form>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>On Hand</th>
              <th>Incoming</th>
              <th>Committed</th>
              <th>Safety Stock</th>
              <th>Target Stock</th>
              <th>Suggested Qty</th>
              <th>Risk</th>
              <th>Status</th>
              <th className="w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto"></div></td></tr>
            ) : recommendations.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">No recommendations found</td></tr>
            ) : (
              recommendations.map(rec => (
                <tr key={rec.id}>
                  <td className="font-medium">{rec.product?.name} <br/><span className="text-sm text-gray-500 font-mono">{rec.product?.sku}</span></td>
                  <td>{rec.onHandQty}</td>
                  <td>{rec.incomingQty}</td>
                  <td>{rec.committedQty}</td>
                  <td>{rec.safetyStock}</td>
                  <td>{rec.targetStock}</td>
                  <td className="font-bold text-blue-600">{rec.finalSuggestedQty}</td>
                  <td><span className={`badge ${getRiskBadge(rec.riskLevel)}`}>{rec.riskLevel}</span></td>
                  <td><span className={`badge ${rec.status === 'PENDING' ? 'badge-yellow' : rec.status === 'APPROVED' ? 'badge-green' : rec.status === 'REJECTED' ? 'badge-red' : 'badge-gray'}`}>{rec.status}</span></td>
                  <td>
                    <div className="flex gap-1">
                      {rec.status === 'PENDING' && (
                        <>
                          <button onClick={() => setApproveModal(rec)} className="text-green-600 hover:underline text-sm">Approve</button>
                          <button onClick={() => setRejectModal(rec)} className="text-red-600 hover:underline text-sm ml-2">Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPagination({...pagination, page: pagination.page - 1})} disabled={pagination.page === 1} className="btn-secondary text-sm">Previous</button>
            <button onClick={() => setPagination({...pagination, page: pagination.page + 1})} disabled={pagination.page === pagination.totalPages} className="btn-secondary text-sm">Next</button>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-semibold">Approve Recommendation</h2></div>
            <div className="p-6 space-y-4">
              <p>Product: <span className="font-medium">{approveModal.product?.name}</span></p>
              <p>Suggested Qty: <span className="font-medium text-blue-600">{approveModal.finalSuggestedQty}</span></p>
              <div>
                <label className="label">Approved Quantity</label>
                <input type="number" min="0" defaultValue={approveModal.finalSuggestedQty} ref={(el) => approveModal.approvedQtyInput = el} className="input" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setApproveModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { onApprove(approveModal.id, approveModal.approvedQtyInput?.valueAsNumber || approveModal.finalSuggestedQty); setApproveModal(null); }} className="btn-primary flex-1">Approve</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200"><h2 className="text-xl font-semibold">Reject Recommendation</h2></div>
            <div className="p-6 space-y-4">
              <p>Product: <span className="font-medium">{rejectModal.product?.name}</span></p>
              <div>
                <label className="label">Reason for Rejection *</label>
                <textarea ref={(el) => rejectModal.reasonInput = el} rows={3} required className="input" placeholder="Why are you rejecting this recommendation?" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { onReject(rejectModal.id, rejectModal.reasonInput?.value); setRejectModal(null); }} className="btn-danger flex-1">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlowMovingTab({ slowMoving }) {
  return (
    <div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>On Hand</th>
              <th>Days Since Sale</th>
              <th>Inventory Value</th>
            </tr>
          </thead>
          <tbody>
            {slowMoving.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No slow-moving products</td></tr>
            ) : (
              slowMoving.map(item => (
                <tr key={item.product?.id || item.id}>
                  <td className="font-medium">{item.product?.name}</td>
                  <td className="font-mono text-sm">{item.product?.sku}</td>
                  <td>{item.product?.category?.name}</td>
                  <td>{item.onHand}</td>
                  <td>{item.daysSinceLastSale}</td>
                  <td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.inventoryValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpiryRiskTab({ expiryRisk }) {
  return (
    <div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch Number</th>
              <th>Expiry Date</th>
              <th>Days Left</th>
              <th>Quantity</th>
              <th>Value at Risk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {expiryRisk.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No expiring batches</td></tr>
            ) : (
              expiryRisk.map(item => (
                <tr key={item.batch?.id || item.id}>
                  <td className="font-medium">{item.product?.name || item.batch?.product?.name}</td>
                  <td className="font-mono">{item.batch?.batchNumber || item.batchNumber}</td>
                  <td>{item.batch?.expiryDate ? new Date(item.batch?.expiryDate).toLocaleDateString() : new Date(item.expiryDate).toLocaleDateString()}</td>
                  <td>{item.daysUntilExpiry}</td>
                  <td>{item.batch?.quantityOnHand || item.quantityOnHand}</td>
                  <td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.valueAtRisk)}</td>
                  <td><span className={`badge ${item.riskLevel === 'EXPIRED' ? 'badge-red' : item.riskLevel === 'CRITICAL' ? 'badge-yellow' : 'badge-blue'}`}>{item.riskLevel}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ForecastsTab({ forecasts, modelInfo }) {
  // Aggregate daily predicted demand for the chart
  const dateMap = {};
  forecasts.forEach(f => {
    const d = new Date(f.targetDate).toLocaleDateString();
    dateMap[d] = (dateMap[d] || 0) + Number(f.predictedDemand);
  });
  const chartData = Object.keys(dateMap).map(date => ({
    date,
    demand: Number(dateMap[date].toFixed(1)),
  }));

  const activeModel = modelInfo?.version || forecasts[0]?.modelVersion || 'None';
  const activeMethod = forecasts[0]?.forecastMethod || (modelInfo?.status === 'ACTIVE' ? 'MODEL' : 'BASELINE_MOVING_AVERAGE');
  const provenance = modelInfo?.data_provenance || 'M5 Benchmark';
  const testMae = modelInfo?.metrics?.test?.mae;
  const improvement = modelInfo?.metrics?.improvement_over_best_baseline_pct;

  return (
    <div className="space-y-6">
      {/* Forecast Meta KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Active Forecast Records</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{forecasts.length}</p>
          <p className="text-xs text-gray-400 mt-1">Horizon: 7 Days</p>
        </div>
        <div className="card p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Model Version</p>
          <p className="text-lg font-bold font-mono text-blue-600 mt-1 truncate" title={activeModel}>{activeModel}</p>
          <p className="text-xs text-gray-500 mt-1">Data: <span className="font-medium text-gray-700">{provenance}</span></p>
        </div>
        <div className="card p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Primary Method</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{activeMethod}</p>
          <p className="text-xs text-gray-500 mt-1">{modelInfo?.model_family || 'Gradient Boosting'}</p>
        </div>
        <div className="card p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">Validation Metric</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{testMae ? `MAE ${testMae}` : 'Standard'}</p>
          <p className="text-xs text-green-700 mt-1 font-medium">{improvement ? `+${improvement}% vs baseline` : 'Evaluated'}</p>
        </div>
      </div>

      {/* Aggregate Demand Chart */}
      {chartData.length > 0 && (
        <div className="card p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Predicted Store Demand by Date (Next 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="demand" fill="#3b82f6" name="Predicted Demand (Units)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Forecast Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Target Date</th>
              <th>Product</th>
              <th>Predicted Demand</th>
              <th>Method</th>
              <th>Model Version</th>
              <th>Run ID</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No forecasts found. Click &quot;Recalculate Recommendations&quot; to generate demand predictions.
                </td>
              </tr>
            ) : (
              forecasts.map(f => (
                <tr key={f.id}>
                  <td className="font-medium">{new Date(f.targetDate).toLocaleDateString()}</td>
                  <td>
                    <span className="font-medium text-gray-900">{f.product?.name}</span>
                    <br />
                    <span className="text-xs text-gray-500 font-mono">{f.product?.sku}</span>
                  </td>
                  <td className="font-bold text-blue-600">{f.predictedDemand} units</td>
                  <td>
                    <span className={`badge ${f.forecastMethod === 'MODEL' ? 'badge-blue' : 'badge-yellow'}`}>
                      {f.forecastMethod}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{f.modelVersion}</td>
                  <td className="font-mono text-xs text-gray-500">{f.runId}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
