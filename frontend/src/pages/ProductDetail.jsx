import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovements();
    }
  }, [id, activeTab]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/products/${id}`);
      setProduct(res.data.product);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      setMovementsLoading(true);
      setMovementsError(null);
      const res = await api.get(`/inventory/${id}/movements`, { params: { limit: 50 } });
      setMovements(res.data.data || []);
    } catch (err) {
      setMovementsError(err.response?.data?.error || err.message || 'Failed to load movements');
    } finally {
      setMovementsLoading(false);
    }
  };

  const handleStatusChange = async (active) => {
    try {
      await api.patch(`/products/${id}/status`, { active });
      fetchProduct();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>;
  }
  if (error) {
    return <div className="text-center p-8 text-red-600">Error loading product: {error}</div>;
  }
  if (!product) {
    return <div className="text-center p-8 text-gray-500">Product not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/products" className="text-blue-600 hover:underline text-sm mb-2 inline-block">← Back to Products</Link>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleStatusChange(!product.active)} className={`btn ${product.active ? 'btn-secondary' : 'btn-primary'}`}>
            {product.active ? 'Deactivate' : 'Activate'}
          </button>
          <Link to={`/products/${id}/edit`} className="btn-secondary">Edit</Link>
        </div>
      </div>

      {/* Product Header */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">SKU</p>
            <p className="font-mono text-lg font-medium">{product.sku}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Barcode</p>
            <p className="font-mono text-lg font-medium">{product.barcode || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cost Price</p>
            <p className="font-medium text-lg">{formatCurrency(product.costPrice)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Selling Price</p>
            <p className="font-medium text-lg text-blue-600">{formatCurrency(product.sellingPrice)}</p>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Category</p>
            <p className="font-medium">{product.category?.name || 'Uncategorized'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Unit of Measure</p>
            <p className="font-medium">{product.unitOfMeasure}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`badge ${product.active ? 'badge-green' : 'badge-gray'}`}>
              {product.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {product.description && (
          <div className="mt-6">
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-gray-900">{product.description}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['details', 'inventory', 'batches', 'movements'].map(tab => (
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {product.inventory?.map((inv, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Store: {inv.store?.name}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div><span className="text-gray-500">On Hand:</span> <span className="font-medium ml-2">{inv.onHand}</span></div>
                      <div><span className="text-gray-500">Reserved:</span> <span className="font-medium ml-2">{inv.reserved}</span></div>
                      <div><span className="text-gray-500">Available:</span> <span className="font-medium ml-2 text-blue-600">{inv.available}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && product.inventory && (
            <div className="space-y-4">
              {product.inventory.map((inv, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">{inv.store?.name}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-gray-500">On Hand:</span> <span className="font-medium ml-2">{inv.onHand}</span></div>
                    <div><span className="text-gray-500">Reserved:</span> <span className="font-medium ml-2">{inv.reserved}</span></div>
                    <div><span className="text-gray-500">Available:</span> <span className="font-medium ml-2 text-blue-600">{inv.available}</span></div>
                    <div><span className="text-gray-500">Safety Stock:</span> <span className="font-medium ml-2">{inv.safetyStock}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'batches' && (
            <div>
              {product.productBatches?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Batch Number</th>
                        <th>Expiry Date</th>
                        <th>Quantity</th>
                        <th>Store</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.productBatches.map(batch => (
                        <tr key={batch.id}>
                          <td className="font-mono">{batch.batchNumber}</td>
                          <td>{new Date(batch.expiryDate).toLocaleDateString()}</td>
                          <td>{batch.quantityOnHand}</td>
                          <td>{batch.store?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No batches recorded</p>
              )}
            </div>
          )}

          {activeTab === 'movements' && (
            <div>
              {movementsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                </div>
              ) : movementsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">{movementsError}</p>
                  <button onClick={fetchMovements} className="btn-secondary text-sm">
                    Retry
                  </button>
                </div>
              ) : movements.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Movement Type</th>
                        <th>Quantity Delta</th>
                        <th>Reason</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => {
                        const isPositive = m.quantityDelta > 0;
                        return (
                          <tr key={m.id}>
                            <td className="text-sm text-gray-600">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td>
                              <span className="badge badge-gray font-mono text-xs">
                                {m.movementType}
                              </span>
                            </td>
                            <td className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                            </td>
                            <td className="text-sm text-gray-700">
                              {m.reason || '—'}
                            </td>
                            <td className="text-xs text-gray-500 font-mono">
                              {m.referenceType ? `${m.referenceType}: ${m.referenceId || ''}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No stock movements recorded</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}