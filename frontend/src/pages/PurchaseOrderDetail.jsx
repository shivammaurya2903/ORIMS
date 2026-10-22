import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [receiving, setReceiving] = useState(false);
  const [receiptData, setReceiptData] = useState({ receiptReference: '', supplierDeliveryRef: '', items: [] });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/purchase-orders/${id}`);
      setOrder(res.data.purchaseOrder);
      // Initialize receipt items
      if (res.data.purchaseOrder.items) {
        setReceiptData(prev => ({
          ...prev,
          items: res.data.purchaseOrder.items.map(item => ({
            purchaseOrderItemId: item.id,
            productName: item.product?.name,
            orderedQty: item.orderedQty,
            receivedQty: item.receivedQty,
            remaining: item.remaining,
            qtyReceived: 0,
            unitCost: item.unitCost,
            batchNumber: '',
            batchExpiryDate: '',
          }))
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/submit`);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!receiptData.receiptReference.trim()) {
      alert('Please enter a receipt reference');
      return;
    }
    const validItems = receiptData.items.filter(item => item.qtyReceived > 0);
    if (validItems.length === 0) {
      alert('Please specify quantities to receive');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/receive`, {
        receiptReference: receiptData.receiptReference,
        supplierDeliveryRef: receiptData.supplierDeliveryRef,
        items: validItems.map(item => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          qtyReceived: item.qtyReceived,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber || null,
          batchExpiryDate: item.batchExpiryDate || null,
        })),
      });
      setReceiving(false);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to receive order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/cancel`);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;
  if (!order) return <div className="text-center p-8 text-gray-500">Order not found</div>;

  const getStatusBadge = (status) => {
    const badges = { DRAFT: 'badge-gray', SUBMITTED: 'badge-blue', PARTIALLY_RECEIVED: 'badge-yellow', RECEIVED: 'badge-green', CANCELLED: 'badge-red' };
    return badges[status] || 'badge-gray';
  };

  const canReceive = ['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(order.status);
  const canSubmit = order.status === 'DRAFT';
  const canCancel = ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED'].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/purchase-orders" className="text-blue-600 hover:underline text-sm mb-2 inline-block">← Back to Purchase Orders</Link>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Order</h1>
        </div>
        <div className="flex gap-3">
          <span className={`badge ${getStatusBadge(order.status)} px-3 py-1 text-sm`}>{order.status}</span>
          {canSubmit && <button onClick={handleSubmit} disabled={actionLoading} className="btn-primary">Submit</button>}
          {canReceive && !receiving && <button onClick={() => setReceiving(true)} className="btn-primary">Receive</button>}
          {canCancel && <button onClick={handleCancel} disabled={actionLoading} className="btn-danger">Cancel</button>}
        </div>
      </div>

      {/* Order Header */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="font-medium">{order.supplier?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Order Date</p>
            <p>{new Date(order.orderDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expected Date</p>
            <p>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created By</p>
            <p>{order.createdBy}</p>
          </div>
        </div>
        {order.approvedBy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Approved By</p>
              <p>{order.approvedBy}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['details', 'receiving', 'receipts'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div>
              {order.items?.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Product</p>
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{item.product?.sku}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ordered</p>
                      <p className="font-medium">{item.orderedQty}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Received</p>
                      <p className="font-medium text-blue-600">{item.totalReceived || item.receivedQty}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Remaining</p>
                      <p className="font-medium">{item.remaining || (item.orderedQty - (item.receivedQty || 0))}</p>
                    </div>
                    <div className="md:col-span-4 grid grid-cols-3 gap-4 mt-2 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-sm text-gray-500">Unit Cost</p>
                        <p>{formatCurrency(item.unitCost)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Tax Rate</p>
                        <p>{(item.taxRate * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Discount</p>
                        <p>{formatCurrency(item.discount)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'receiving' && (
            <div>
              {!receiving ? (
                <button onClick={() => setReceiving(true)} className="btn-primary">Start Receiving</button>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium">Record Receipt</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label">Receipt Reference *</label>
                      <input value={receiptData.receiptReference} onChange={(e) => setReceiptData({...receiptData, receiptReference: e.target.value})} required className="input" placeholder="REC-001" />
                    </div>
                    <div>
                      <label className="label">Supplier Delivery Ref</label>
                      <input value={receiptData.supplierDeliveryRef} onChange={(e) => setReceiptData({...receiptData, supplierDeliveryRef: e.target.value})} className="input" placeholder="Optional" />
                    </div>
                  </div>
                  
                  <div className="table-container">
                    <table className="table text-sm">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Ordered</th>
                          <th>Already Received</th>
                          <th>Remaining</th>
                          <th>Receiving Now</th>
                          <th>Unit Cost</th>
                          <th>Batch Number</th>
                          <th>Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptData.items.filter(item => item.remaining > 0).map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.productName}</td>
                            <td>{item.orderedQty}</td>
                            <td>{item.receivedQty}</td>
                            <td>{item.remaining}</td>
                            <td>
                              <input type="number" min="0" max={item.remaining} value={item.qtyReceived} onChange={(e) => setReceiptData({...receiptData, items: receiptData.items.map((i, i2) => i2 === idx ? { ...i, qtyReceived: parseInt(e.target.value) || 0 } : i)})} className="input text-sm w-20" />
                            </td>
                            <td>
                              <input type="number" step="0.01" min="0" value={item.unitCost} onChange={(e) => setReceiptData({...receiptData, items: receiptData.items.map((i, i2) => i2 === idx ? { ...i, unitCost: parseFloat(e.target.value) || 0 } : i)})} className="input text-sm w-24" />
                            </td>
                            <td>
                              <input type="text" value={item.batchNumber} onChange={(e) => setReceiptData({...receiptData, items: receiptData.items.map((i, i2) => i2 === idx ? { ...i, batchNumber: e.target.value } : i)})} className="input text-sm" placeholder="Optional" />
                            </td>
                            <td>
                              <input type="date" value={item.batchExpiryDate} onChange={(e) => setReceiptData({...receiptData, items: receiptData.items.map((i, i2) => i2 === idx ? { ...i, batchExpiryDate: e.target.value } : i)})} className="input text-sm" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button onClick={() => setReceiving(false)} className="btn-secondary">Cancel</button>
                    <button onClick={handleReceive} disabled={actionLoading} className="btn-primary">{actionLoading ? 'Receiving...' : 'Confirm Receipt'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'receipts' && (
            <div>
              {order.receipts?.length > 0 ? (
                <div className="space-y-4">
                  {order.receipts.map(receipt => (
                    <div key={receipt.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium">Receipt: {receipt.receiptReference}</p>
                          <p className="text-sm text-gray-500">Received: {new Date(receipt.receivedAt).toLocaleString()} by {receipt.receivedBy}</p>
                        </div>
                        {receipt.supplierDeliveryRef && <span className="text-sm text-gray-500">Supplier Ref: {receipt.supplierDeliveryRef}</span>}
                      </div>
                      <div className="table-container">
                        <table className="table text-sm">
                          <thead><tr><th>Product</th><th>Qty Received</th><th>Unit Cost</th><th>Batch</th><th>Expiry</th></tr></thead>
                          <tbody>
                            {receipt.items?.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.purchaseOrderItem?.product?.name}</td>
                                <td>{item.qtyReceived}</td>
                                <td>{formatCurrency(item.unitCost)}</td>
                                <td>{item.batchNumber || '-'}</td>
                                <td>{item.batchExpiryDate ? new Date(item.batchExpiryDate).toLocaleDateString() : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No receipts recorded yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}