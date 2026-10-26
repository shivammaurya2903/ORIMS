import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Settings() {
  const [store, setStore] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('store');
  const [saving, setSaving] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: '', location: '', taxRate: 0.10, currency: 'INR', timezone: 'Asia/Kolkata' });
  const [policyForm, setPolicyForm] = useState({ productId: '', safetyStock: 0, serviceLevel: 0.95, reviewPeriod: 7, minLevel: '', maxLevel: '' });
  const [editingPolicy, setEditingPolicy] = useState(null);

  useEffect(() => {
    fetchStore();
    fetchPolicies();
    fetchProducts();
  }, []);

  const fetchStore = async () => {
    try {
      const res = await api.get('/settings/store');
      const st = res.data.store;
      setStore(st);
      if (st) {
        setStoreForm({
          name: st.name || '',
          location: st.location || '',
          taxRate: st.taxRate !== null && st.taxRate !== undefined ? Number(st.taxRate) : 0.10,
          currency: st.currency || 'INR',
          timezone: st.timezone || 'Asia/Kolkata',
        });
      }
    } catch (err) {
      console.error('Failed to fetch store', err);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await api.get('/settings/inventory-policies');
      setPolicies(res.data.data);
    } catch (err) {
      console.error('Failed to fetch policies', err);
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

  const handleStoreUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: storeForm.name.trim(),
        location: storeForm.location?.trim() || null,
        taxRate: !isNaN(storeForm.taxRate) ? Number(storeForm.taxRate) : 0.10,
        currency: storeForm.currency?.trim()?.toUpperCase() || 'INR',
        timezone: storeForm.timezone?.trim() || 'Asia/Kolkata',
      };
      await api.put('/settings/store', payload);
      await fetchStore();
      alert('Store settings updated');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update store');
    } finally {
      setSaving(false);
    }
  };

  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      productId: policyForm.productId,
      safetyStock: parseInt(policyForm.safetyStock),
      serviceLevel: parseFloat(policyForm.serviceLevel),
      reviewPeriod: parseInt(policyForm.reviewPeriod),
      minLevel: policyForm.minLevel ? parseInt(policyForm.minLevel) : null,
      maxLevel: policyForm.maxLevel ? parseInt(policyForm.maxLevel) : null,
    };
    try {
      if (editingPolicy) {
        await api.put(`/settings/inventory-policies/${editingPolicy.productId}`, data);
      } else {
        await api.post('/settings/inventory-policies', data);
      }
      setPolicyForm({ productId: '', safetyStock: 0, serviceLevel: 0.95, reviewPeriod: 7, minLevel: '', maxLevel: '' });
      setEditingPolicy(null);
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const editPolicy = (policy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      productId: policy.productId,
      safetyStock: policy.safetyStock,
      serviceLevel: policy.serviceLevel,
      reviewPeriod: policy.reviewPeriod,
      minLevel: policy.minLevel || '',
      maxLevel: policy.maxLevel || '',
    });
  };

  const deletePolicy = async (productId) => {
    if (!confirm('Delete this inventory policy?')) return;
    try {
      // Note: DELETE endpoint not implemented, would need backend
      alert('Delete not implemented in backend yet');
    } catch (err) {
      alert('Failed to delete policy');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure store and inventory policies</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {['store', 'policies'].map(tab => (
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
          {activeTab === 'store' && (
            <div className="max-w-2xl">
              <form onSubmit={handleStoreUpdate} className="space-y-4">
                <h3 className="text-lg font-semibold">Store Information</h3>
                <div>
                  <label className="label">Store Name *</label>
                  <input value={storeForm.name} onChange={(e) => setStoreForm({...storeForm, name: e.target.value})} required className="input" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input value={storeForm.location} onChange={(e) => setStoreForm({...storeForm, location: e.target.value})} className="input" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Tax Rate</label>
                    <input type="number" step="0.01" min="0" max="1" value={storeForm.taxRate} onChange={(e) => setStoreForm({...storeForm, taxRate: parseFloat(e.target.value)})} className="input" />
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <input value={storeForm.currency} onChange={(e) => setStoreForm({...storeForm, currency: e.target.value})} className="input" maxLength={3} />
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <input value={storeForm.timezone} onChange={(e) => setStoreForm({...storeForm, timezone: e.target.value})} className="input" />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Store Settings'}</button>
              </form>
            </div>
          )}

          {activeTab === 'policies' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Inventory Policies</h3>
                <button onClick={() => { setEditingPolicy(null); setPolicyForm({ productId: '', safetyStock: 0, serviceLevel: 0.95, reviewPeriod: 7, minLevel: '', maxLevel: '' }); }} className="btn-primary">Add Policy</button>
              </div>

              {/* Policy Form */}
              <form onSubmit={handlePolicySubmit} className="card p-6 mb-6 space-y-4">
                <h4 className="font-medium">{editingPolicy ? 'Edit Policy' : 'Create Policy'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Product *</label>
                    <select value={policyForm.productId} onChange={(e) => setPolicyForm({...policyForm, productId: e.target.value})} required disabled={editingPolicy} className="input">
                      <option value="">Select Product</option>
                      {products.filter(p => !policies.some(pol => pol.productId === p.id) || editingPolicy?.productId === p.id).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Safety Stock</label>
                    <input type="number" min="0" value={policyForm.safetyStock} onChange={(e) => setPolicyForm({...policyForm, safetyStock: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">Service Level</label>
                    <input type="number" step="0.01" min="0" max="1" value={policyForm.serviceLevel} onChange={(e) => setPolicyForm({...policyForm, serviceLevel: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">Review Period (days)</label>
                    <input type="number" min="1" value={policyForm.reviewPeriod} onChange={(e) => setPolicyForm({...policyForm, reviewPeriod: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">Min Level</label>
                    <input type="number" min="0" value={policyForm.minLevel} onChange={(e) => setPolicyForm({...policyForm, minLevel: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">Max Level</label>
                    <input type="number" min="0" value={policyForm.maxLevel} onChange={(e) => setPolicyForm({...policyForm, maxLevel: e.target.value})} className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : (editingPolicy ? 'Update Policy' : 'Create Policy')}</button>
                  {editingPolicy && <button type="button" onClick={() => { setEditingPolicy(null); setPolicyForm({ productId: '', safetyStock: 0, serviceLevel: 0.95, reviewPeriod: 7, minLevel: '', maxLevel: '' }); }} className="btn-secondary">Cancel</button>}
                </div>
              </form>

              {/* Policies Table */}
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Safety Stock</th>
                        <th>Service Level</th>
                        <th>Review Period</th>
                        <th>Min Level</th>
                        <th>Max Level</th>
                        <th className="w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">No inventory policies configured</td></tr>
                      ) : (
                        policies.map(policy => (
                          <tr key={policy.id}>
                            <td className="font-medium">{policy.product?.name}</td>
                            <td className="font-mono text-sm">{policy.product?.sku}</td>
                            <td>{policy.safetyStock}</td>
                            <td>{(policy.serviceLevel * 100).toFixed(0)}%</td>
                            <td>{policy.reviewPeriod} days</td>
                            <td>{policy.minLevel || '-'}</td>
                            <td>{policy.maxLevel || '-'}</td>
                            <td>
                              <div className="flex gap-1">
                                <button onClick={() => editPolicy(policy)} className="text-blue-600 hover:underline text-sm">Edit</button>
                                <button onClick={() => deletePolicy(policy.productId)} className="text-red-600 hover:underline text-sm">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}