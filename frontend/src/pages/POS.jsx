import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import { v4 as uuidv4 } from 'uuid';

export default function POS() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [searching, setSearching] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidv4());

  const searchProducts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get('/products', { params: { search: query, active: true, limit: 10 } });
      setSearchResults(res.data.data);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => searchProducts(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchProducts]);

  const addToCart = (product) => {
    setIdempotencyKey(uuidv4());
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.totalAvailable) {
          alert('Cannot add more than available stock');
          return prev;
        }
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, product, quantity: 1 }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (productId, quantity) => {
    setIdempotencyKey(uuidv4());
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId));
      return;
    }
    const item = cart.find(i => i.productId === productId);
    if (item && quantity > item.product.totalAvailable) {
      alert('Cannot exceed available stock');
      return;
    }
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity } : item));
  };

  const removeFromCart = (productId) => {
    setIdempotencyKey(uuidv4());
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + Number(item.product.sellingPrice) * item.quantity, 0);
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || checkingOut) return;
    
    setCheckingOut(true);
    setError(null);
    
    try {
      const items = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));
      const res = await api.post('/sales', { items, paymentMethod, idempotencyKey });
      
      if (res.data.idempotent) {
        setSuccess('Sale already processed (duplicate request)');
      } else {
        setSuccess('Sale completed successfully!');
        setReceipt(res.data.sale);
        setCart([]);
        setIdempotencyKey(uuidv4());
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-500">Process a new sale</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search & Cart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Add Products</h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, or barcode..."
                className="input pl-10"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku} | {formatCurrency(product.sellingPrice)} | Avail: {product.totalAvailable}</p>
                    </div>
                    <span className="btn-primary text-sm py-1 px-3">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-sm text-red-600 hover:underline">Clear Cart</button>
              )}
            </div>
            <div className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  <p>Cart is empty. Search for products to add.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-sm text-gray-500">{formatCurrency(item.product.sellingPrice)} each • Avail: {item.product.totalAvailable}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 rounded text-gray-600 hover:bg-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                        <span className="w-10 text-center font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 rounded text-gray-600 hover:bg-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                        <button onClick={() => removeFromCart(item.productId)} className="p-1 rounded text-red-600 hover:bg-red-50 ml-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                      <p className="font-medium w-24 text-right">{formatCurrency(Number(item.product.sellingPrice) * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Checkout Panel */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-6">Checkout</h2>
            
            {error && <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>}
            {success && <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 rounded-lg">{success}</div>}
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="label">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MOBILE">Mobile Payment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (10%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-3">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              className="btn-primary w-full py-3 text-lg mt-4"
            >
              {checkingOut ? 'Processing...' : `Pay ${formatCurrency(total)}`}
            </button>

            {receipt && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="font-medium text-green-800">Sale Complete!</p>
                <p className="text-sm text-green-700 mt-1">Receipt: {receipt.receiptNumber}</p>
                <button onClick={() => { setReceipt(null); setSuccess(null); setIdempotencyKey(uuidv4()); }} className="mt-3 text-sm text-green-600 hover:underline">New Sale</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}