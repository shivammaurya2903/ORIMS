import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function SupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [newProduct, setNewProduct] = useState({ productId: '', leadTimeDays: 7, minOrderQty: 1, packMultiple: 1, unitCost: '' });
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchSupplier();
    fetchProducts();
  }, [id]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/suppliers/${id}`);
      setSupplier(res.data.supplier);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { active: true, limit: 100 } });
      setProducts(res.data.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const addSupplierProduct = async (e) => {
    e.preventDefault();
    const data = { ...newProduct, unitCost: parseFloat(newProduct.unitCost) };
    try {
      await api.post(`/suppliers/${id}/products`, data);
      setNewProduct({ productId: '', leadTimeDays: 7, minOrderQty: 1, packMultiple: 1, unitCost: '' });
      fetchSupplier();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add product');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div></div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;
  if (!supplier) return <div className="text-center p-8 text-gray-500">Supplier not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/suppliers" className="text-blue-600 hover:underline text-sm mb-2 inline-block">← Back to Suppliers</Link>
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['details', 'products', 'orders'].map(tab => (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p>{supplier.email || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p>{supplier.phone || 'Not provided'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p>{supplier.address || 'Not provided'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Notes</p>
                <p>{supplier.notes || 'No notes'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`badge ${supplier.active ? 'badge-green' : 'badge-gray'}`}>
                  {supplier.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <div className="mb-6">
                <h3 className="font-medium mb-4">Add Product to Supplier</h3>
                <form onSubmit={addSupplierProduct} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="label">Product *</label>
                    <select value={newProduct.productId} onChange={(e) => setNewProduct({...newProduct, productId: e.target.value})} required className="input">
                      <option value="">Select Product</option>
                      {products.filter(p => !supplier.supplierProducts?.some(sp => sp.productId === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Lead Time (days)</label>
                    <input type="number" value={newProduct.leadTimeDays} onChange={(e) => setNewProduct({...newProduct, leadTimeDays: parseInt(e.target.value)})} min="0" className="input" />
                  </div>
                  <div>
                    <label className="label">Min Order Qty</label>
                    <input type="number" value={newProduct.minOrderQty} onChange={(e) => setNewProduct({...newProduct, minOrderQty: parseInt(e.target.value)})} min="1" className="input" />
                  </div>
                  <div>
                    <label className="label">Pack Multiple</label>
                    <input type="number" value={newProduct.packMultiple} onChange={(e) => setNewProduct({...newProduct, packMultiple: parseInt(e.target.value)})} min="1" className="input" />
                  </div>
                  <div>
                    <label className="label">Unit Cost *</label>
                    <input type="number" step="0.01" value={newProduct.unitCost} onChange={(e) => setNewProduct({...newProduct, unitCost: e.target.value})} min="0" required className="input" />
                  </div>
                  <div className="md:col-span-5 flex gap-3">
                    <button type="submit" className="btn-primary">Add Product</button>
                  </div>
                </form>
              </div>

              {supplier.supplierProducts?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Lead Time</th>
                        <th>Min Order</th>
                        <th>Pack Multiple</th>
                        <th>Unit Cost</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.supplierProducts.map(sp => (
                        <tr key={sp.productId}>
                          <td>{sp.product?.name}</td>
                          <td className="font-mono text-sm">{sp.product?.sku}</td>
                          <td>{sp.leadTimeDays} days</td>
                          <td>{sp.minOrderQty}</td>
                          <td>{sp.packMultiple}</td>
                          <td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(sp.unitCost)}</td>
                          <td><span className={`badge ${sp.active ? 'badge-green' : 'badge-gray'}`}>{sp.active ? 'Active' : 'Inactive'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No products linked to this supplier</p>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              {supplier.purchaseOrders?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Expected</th>
                        <th>Status</th>
                        <th>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.purchaseOrders.map(po => (
                        <tr key={po.id}>
                          <td className="font-mono text-sm">{po.id.slice(0, 8)}...</td>
                          <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                          <td>{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'Not set'}</td>
                          <td><span className={`badge ${po.status === 'RECEIVED' ? 'badge-green' : po.status === 'PARTIALLY_RECEIVED' ? 'badge-yellow' : po.status === 'SUBMITTED' ? 'badge-blue' : 'badge-gray'}`}>{po.status}</span></td>
                          <td>{po.items?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No purchase orders for this supplier</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}