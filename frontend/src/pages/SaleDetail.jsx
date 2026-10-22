import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [returnModal, setReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);

  useEffect(() => {
    fetchSale();
  }, [id]);

  const fetchSale = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/sales/${id}`);
      setSale(res.data.sale);
      // Initialize return items
      if (res.data.sale.items) {
        setReturnItems(res.data.sale.items.map(item => ({
          saleItemId: item.id,
          productName: item.product?.name,
          maxReturnable: item.quantity,
          qtyReturned: 0,
          restockQty: 0,
          writeOffQty: 0,
        })));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      alert('Please provide a reason for the return');
      return;
    }
    
    const validItems = returnItems.filter(item => item.qtyReturned > 0);
    if (validItems.length === 0) {
      alert('Please specify quantities to return');
      return;
    }

    // Validate restock + writeoff = returned
    for (const item of validItems) {
      if (item.restockQty + item.writeOffQty !== item.qtyReturned) {
        alert(`For ${item.productName}, restock + write-off must equal returned quantity`);
        return;
      }
    }

    setProcessingReturn(true);
    try {
      await api.post(`/sales/${id}/returns`, { items: validItems, reason: returnReason });
      setReturnModal(false);
      setReturnReason('');
      fetchSale();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to process return');
    } finally {
      setProcessingReturn(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;
  if (!sale) return <div className="text-center p-8 text-gray-500">Sale not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/sales" className="text-blue-600 hover:underline text-sm mb-2 inline-block">← Back to Sales</Link>
          <h1 className="text-2xl font-bold text-gray-900">Sale Details</h1>
        </div>
        <div className="flex gap-3">
          {sale.status === 'COMPLETED' && (
            <button onClick={() => setReturnModal(true)} className="btn-secondary">Process Return</button>
          )}
        </div>
      </div>

      {/* Sale Header */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500">Receipt Number</p>
            <p className="font-mono text-lg font-medium">{sale.receiptNumber}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium">{new Date(sale.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="font-medium">{sale.paymentMethod}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : sale.status === 'REFUNDED' ? 'badge-yellow' : 'badge-gray'}`}>
              {sale.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Subtotal</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(sale.subtotal)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tax</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(sale.taxTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(sale.total)}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Items</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Unit Cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-medium">{item.product?.name}</td>
                  <td className="font-mono text-sm">{item.product?.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(item.unitCost)}</td>
                  <td>{formatCurrency(item.lineDiscount)}</td>
                  <td>{(item.taxRate * 100).toFixed(1)}%</td>
                  <td className="font-medium">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns */}
      {sale.returns?.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Returns</h2>
          </div>
          <div className="p-4 space-y-4">
            {sale.returns.map((ret, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Return #{idx + 1}</p>
                  <span className="text-sm text-gray-500">{new Date(ret.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-gray-600 mb-2">Reason: {ret.reason}</p>
                <div className="table-container">
                  <table className="table text-sm">
                    <thead><tr><th>Product</th><th>Returned</th><th>Restocked</th><th>Written Off</th></tr></thead>
                    <tbody>
                      {ret.items?.map((ritem, i) => (
                        <tr key={i}>
                          <td>{ritem.saleItem?.product?.name}</td>
                          <td>{ritem.qtyReturned}</td>
                          <td>{ritem.restockQty}</td>
                          <td>{ritem.writeOffQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Process Return for {sale.receiptNumber}</h2>
              <button onClick={() => setReturnModal(false)} className="text-gray-500 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Reason for Return *</label>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} required rows={3} className="input" placeholder="Customer reason for return" />
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium mb-3">Return Items</h3>
                <div className="space-y-3">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.productName}</span>
                        <span className="text-sm text-gray-500">Max: {item.maxReturnable}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="label text-xs">Returned</label>
                          <input type="number" min="0" max={item.maxReturnable} value={item.qtyReturned} onChange={(e) => setReturnItems(prev => prev.map((i, i2) => i2 === idx ? { ...i, qtyReturned: parseInt(e.target.value) || 0 } : i))} className="input text-sm" />
                        </div>
                        <div>
                          <label className="label text-xs">Restock</label>
                          <input type="number" min="0" value={item.restockQty} onChange={(e) => setReturnItems(prev => prev.map((i, i2) => i2 === idx ? { ...i, restockQty: parseInt(e.target.value) || 0 } : i))} className="input text-sm" />
                        </div>
                        <div>
                          <label className="label text-xs">Write Off</label>
                          <input type="number" min="0" value={item.writeOffQty} onChange={(e) => setReturnItems(prev => prev.map((i, i2) => i2 === idx ? { ...i, writeOffQty: parseInt(e.target.value) || 0 } : i))} className="input text-sm" />
                        </div>
                        <div className="flex items-end">
                          <p className="text-xs text-gray-500">Sum must equal returned</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setReturnModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleReturn} disabled={processingReturn} className="btn-primary flex-1">{processingReturn ? 'Processing...' : 'Process Return'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}