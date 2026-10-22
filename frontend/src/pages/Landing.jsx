import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState('inventory');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-blue-600 selection:text-white">
      {/* 1. Public Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-gray-900">ORIMS</span>
                <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  v1.0
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600" aria-label="Main Navigation">
              <a href="#overview" className="hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Overview</a>
              <a href="#features" className="hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Capabilities</a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">How It Works</a>
              <a href="#ml-forecasting" className="hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">ML Optimization</a>
              <a href="#reliability" className="hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">Reliability</a>
            </nav>

            {/* Header Actions */}
            <div className="hidden sm:flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-xs text-gray-600">
                    Signed in as <strong className="text-gray-900">{user.name}</strong> ({user.role})
                  </span>
                  <Link
                    to="/dashboard"
                    className="btn-primary text-sm inline-flex items-center space-x-1.5 py-2 px-4 shadow-sm"
                  >
                    <span>Go to Dashboard</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login"
                    className="btn-primary text-sm inline-flex items-center py-2 px-4 shadow-sm"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
            <div className="flex md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle Navigation Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              Overview
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              Key Capabilities
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              How It Works
            </a>
            <a
              href="#ml-forecasting"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              ML Optimization
            </a>
            <a
              href="#reliability"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              System Reliability
            </a>
            <div className="pt-3 border-t border-gray-100 flex flex-col space-y-2">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary w-full text-center py-2"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-secondary w-full text-center py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full text-center py-2"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {/* 2. Hero Section */}
        <section id="overview" className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-gray-50 pt-14 pb-16 md:pt-20 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-6">
                <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
                <span>Optimised Retail Inventory Management System</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Intelligent Inventory, Checkout &amp; ML Replenishment
              </h1>
              <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
                ORIMS unites product catalogue management, point of sale checkout, purchase order receiving, and machine learning demand forecasting to help retail managers maintain accurate stock levels, mitigate stockout risks, and optimize replenishment schedules.
              </p>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3.5">
                <Link
                  to="/login"
                  className="btn-primary text-base font-semibold px-7 py-3 shadow-sm inline-flex items-center justify-center space-x-2"
                >
                  <span>Sign In to ORIMS</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="#features"
                  className="btn-secondary text-base font-semibold px-6 py-3 inline-flex items-center justify-center text-gray-700 hover:text-gray-900"
                >
                  Explore Capabilities
                </a>
              </div>

              {/* Verified System Architecture Metadata Tag */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 font-mono">
                <span>Node.js Express :3001</span>
                <span>•</span>
                <span>MySQL 8.4 :3306</span>
                <span>•</span>
                <span>FastAPI ML Service :8000</span>
                <span>•</span>
                <span>Single-Store Architecture</span>
              </div>
            </div>

            {/* Operational Workspace Preview Box */}
            <div className="mt-12 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                {/* Mock Window Title Bar */}
                <div className="bg-gray-100/90 border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="ml-2 text-xs font-mono text-gray-600">Sample Operational Workspace (Demo Store)</span>
                  </div>
                  <div className="inline-flex items-center space-x-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>Illustrative Interface Preview</span>
                  </div>
                </div>

                {/* Interactive Demo View Selector Tabs */}
                <div className="bg-gray-50/80 border-b border-gray-200 px-4 flex gap-2 overflow-x-auto text-xs font-medium">
                  <button
                    onClick={() => setActivePreviewTab('inventory')}
                    className={`py-2.5 px-3 border-b-2 transition-colors ${activePreviewTab === 'inventory' ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    1. Real-time Inventory Ledger
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('pos')}
                    className={`py-2.5 px-3 border-b-2 transition-colors ${activePreviewTab === 'pos' ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    2. Atomic POS Checkout
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('ml')}
                    className={`py-2.5 px-3 border-b-2 transition-colors ${activePreviewTab === 'ml' ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    3. Replenishment &amp; ML Horizon
                  </button>
                </div>

                {/* Workspace Preview Content */}
                <div className="p-5 sm:p-6 bg-white">
                  {activePreviewTab === 'inventory' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>Catalogue Position: On-Hand, Reserved, and Available Stock</span>
                        <span className="badge badge-green">Transactional Integrity Verified</span>
                      </div>
                      <div className="overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="min-w-full text-xs divide-y divide-gray-200">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">SKU / Product</th>
                              <th className="px-3 py-2 text-left font-semibold">Category</th>
                              <th className="px-3 py-2 text-right font-semibold">On-Hand</th>
                              <th className="px-3 py-2 text-right font-semibold">Reserved</th>
                              <th className="px-3 py-2 text-right font-semibold">Available</th>
                              <th className="px-3 py-2 text-right font-semibold">Safety Stock</th>
                              <th className="px-3 py-2 text-center font-semibold">Stock Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-800">
                            <tr>
                              <td className="px-3 py-2 font-medium">ELEC-001 (Wireless Headphones)</td>
                              <td className="px-3 py-2 text-gray-500">Electronics</td>
                              <td className="px-3 py-2 text-right font-mono">42</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-400">4</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">38</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-500">10</td>
                              <td className="px-3 py-2 text-center"><span className="badge badge-green">Sufficient</span></td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium">ELEC-002 (USB-C Cable 2m)</td>
                              <td className="px-3 py-2 text-gray-500">Electronics</td>
                              <td className="px-3 py-2 text-right font-mono">14</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-400">2</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-yellow-700">12</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-500">10</td>
                              <td className="px-3 py-2 text-center"><span className="badge badge-yellow">Low Stock</span></td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium">FOOD-001 (Organic Coffee Beans 1kg)</td>
                              <td className="px-3 py-2 text-gray-500">Food &amp; Bev</td>
                              <td className="px-3 py-2 text-right font-mono">35</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-400">0</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">35</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-500">10</td>
                              <td className="px-3 py-2 text-center"><span className="badge badge-green">Sufficient</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-gray-500 italic">
                        Available quantity is dynamically calculated as (QuantityOnHand - ReservedQuantity) with row-version tracking to prevent race conditions.
                      </p>
                    </div>
                  )}

                  {activePreviewTab === 'pos' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>POS Checkout Engine: Concurrency Check &amp; Server-Authoritative Totals</span>
                        <span className="badge badge-blue">Zero Overselling Guarantee</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                          <p className="font-semibold text-gray-900">Cart Submission Payload</p>
                          <div className="font-mono text-gray-700 bg-white p-2 rounded border border-gray-200">
                            <div>POST /api/v1/sales</div>
                            <div className="text-gray-500">IdempotencyKey: idem-sale-912</div>
                            <div className="text-blue-600 mt-1">Item: ELEC-001 x 2 EA</div>
                            <div className="text-gray-500">Payment: CASH | Store: default-store</div>
                          </div>
                          <div className="text-[11px] text-gray-600">
                            Server validates available stock, calculates server-authoritative 10% tax, and decrements stock atomically inside a database transaction.
                          </div>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                          <p className="font-semibold text-gray-900">Immutable Ledger Entry</p>
                          <div className="font-mono text-gray-700 bg-white p-2 rounded border border-gray-200">
                            <div className="text-green-700">Movement: SALE (-2 units)</div>
                            <div>Reference: RCP-20261022-8A4F</div>
                            <div className="text-gray-500">Actor: sales@orims.local</div>
                            <div className="text-gray-500">InventoryOnHand: 42 → 40</div>
                          </div>
                          <div className="text-[11px] text-gray-600">
                            Simultaneous checkouts across cashiers cannot oversell stock due to conditional database update clauses (<code className="font-mono">quantityOnHand &gt;= qty + reserved</code>).
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activePreviewTab === 'ml' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>Replenishment Pipeline: 7-Day ML Forecast + Supplier Constraints</span>
                        <span className="badge badge-purple">Human-in-the-Loop Approval</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Forecast summary */}
                        <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200 text-xs space-y-1.5">
                          <p className="font-semibold text-purple-900">1. ML Demand Projection</p>
                          <p className="text-gray-600">FastAPI ML Service (Port 8000)</p>
                          <div className="font-mono text-purple-700 font-bold text-sm pt-1">
                            ~14 units / week
                          </div>
                          <p className="text-[11px] text-gray-500">
                            HistGradientBoosting model using lag-7, lag-14, and rolling velocity features.
                          </p>
                        </div>

                        {/* Inventory position */}
                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 text-xs space-y-1.5">
                          <p className="font-semibold text-blue-900">2. Net Position (IP)</p>
                          <p className="text-gray-600">OnHand + Inbound - Committed</p>
                          <div className="font-mono text-blue-700 font-bold text-sm pt-1">
                            12 + 0 - 2 = 10 units
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Raw suggested quantity = Target (20) - Net Position (10) = 10 units.
                          </p>
                        </div>

                        {/* Supplier Constraints */}
                        <div className="p-3 bg-green-50/50 rounded-lg border border-green-200 text-xs space-y-1.5">
                          <p className="font-semibold text-green-900">3. Replenishment Recommendation</p>
                          <p className="text-gray-600">Supplier MOQ &amp; Pack Multiple</p>
                          <div className="font-mono text-green-700 font-bold text-sm pt-1">
                            Propose: 15 units (3 cases)
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Rounded up to pack multiple of 5. Awaiting Store Manager approval.
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 italic">
                        Forecasts are statistical demand estimates, not guaranteed predictions. Automated moving-average fallback is applied when sales history is insufficient.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Key Capabilities Section */}
        <section id="features" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Documented &amp; Implemented Modules</h2>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                Core Retail Operations Capabilities
              </p>
              <p className="mt-3 text-sm sm:text-base text-gray-600">
                Engineered to specification across catalogue control, transactional point of sale, goods purchasing, and inventory accounting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Catalogue &amp; SKU Control</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Unique SKU indexing, optional barcode mapping, category taxonomy, cost vs selling prices, unit of measure tagging, and soft deactivation states.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">POS &amp; Atomic Checkout</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Real-time cart validation, server-side sales tax calculation, idempotency replay tokens, and row-level conditional database decrements preventing overselling.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Purchasing &amp; Receiving</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Controlled purchase order state lifecycle (Draft, Submitted, Partially Received, Received, Cancelled) supporting partial goods delivery and delivery receipts.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Stock Movement Ledger</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Immutable audit trail recording sales decrements, purchase receipts, return restocks, damage write-offs, and manual adjustments with required reasons and actor IDs.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Customer Returns &amp; Refunds</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Refund handling enforcing maximum returnable quantities with distinct restock accounting versus damaged write-offs, updating sales status when fully refunded.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Valuation &amp; Turnover Reports</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Analytics covering sales revenue, average order value, inventory valuation at unit cost, COGS inventory turnover ratios, and historical stock movements.
                </p>
              </div>

              {/* Feature 7 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Batch &amp; Expiry Tracking</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Batch number registration, expiration date logging, days-until-expiry calculations, and dedicated risk reporting for perishable or date-sensitive goods.
                </p>
              </div>

              {/* Feature 8 */}
              <div className="card p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Role-Based Security</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Server-enforced access controls across Administrator, Store Manager, Sales Staff, and Inventory Staff with centralized account management.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-20 bg-gray-50 border-t border-gray-200 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Operational Workflow</h2>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                How ORIMS Operates
              </p>
              <p className="mt-3 text-sm sm:text-base text-gray-600">
                A structured, auditable retail workflow from item registration to manager-supervised replenishment.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-3.5">
                  1
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Catalogue &amp; Policies</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Register SKUs, configure safety stocks, and link suppliers with lead time days, minimum order quantities (MOQ), and case pack multiples.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-3.5">
                  2
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Sales &amp; Goods Receipts</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Record point-of-sale customer checkouts and supplier delivery receipts atomically into the append-only stock movement ledger.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-3.5">
                  3
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Forecast &amp; Constraints</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The Python ML engine estimates 7-day demand from sales velocity; Node.js calculates net position and applies supplier MOQ and pack rounding.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-3.5">
                  4
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Manager Approval</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The Store Manager reviews replenishment proposals. Approval creates a draft purchase order; rejection logs an audited review reason.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. ML Forecasting & Architecture Explanation */}
        <section id="ml-forecasting" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-12 lg:gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
                  <span>FastAPI + Scikit-Learn + Node.js Engine</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  ML Optimization &amp; Replenishment Architecture
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  ORIMS decouples statistical inference from business logic. Demand forecasting estimates future sales units, while replenishment rules enforce real store constraints and require manager approval.
                </p>

                <div className="space-y-3.5 text-xs text-gray-600">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Documented Fallback Strategy:</strong> If a product has fewer than 14 days of sales history or the ML service is unreachable, Node.js automatically falls back to moving-average baselines so replenishment is never stalled.
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Supplier Constraint Application:</strong> Raw suggested order quantities are adjusted for lead times, minimum order quantities (MOQ), and case pack multiples before presentation.
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Human-in-the-Loop Governance:</strong> Recommendations are advisory estimates, not autonomous orders. Approval generates a draft PO; rejection records an audited manager note.
                    </div>
                  </div>
                </div>
              </div>

              {/* Architecture Data Flow Box */}
              <div className="mt-8 lg:mt-0 lg:col-span-6">
                <div className="bg-gray-900 text-gray-100 p-5 sm:p-6 rounded-xl shadow-md font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 text-gray-400 text-[11px]">
                    <span>ARCHITECTURE DATA FLOW</span>
                    <span>PORT 8000 &harr; PORT 3001</span>
                  </div>
                  <div className="p-3 rounded bg-gray-800 border border-gray-700">
                    <p className="text-blue-400 font-semibold mb-0.5">[1] Node.js Backend (:3001)</p>
                    <p className="text-gray-300">Extracts 14-day sales velocity and lag features from MySQL</p>
                  </div>
                  <div className="text-center text-gray-500 font-bold text-[11px]">&darr; HTTP POST /forecast (Bearer Token Auth)</div>
                  <div className="p-3 rounded bg-gray-800 border border-gray-700">
                    <p className="text-purple-400 font-semibold mb-0.5">[2] FastAPI ML Service (:8000)</p>
                    <p className="text-gray-300">Executes scikit-learn model; returns 7-day predicted demand</p>
                  </div>
                  <div className="text-center text-gray-500 font-bold text-[11px]">&darr; Returns JSON Predicted Units Array</div>
                  <div className="p-3 rounded bg-gray-800 border border-gray-700">
                    <p className="text-green-400 font-semibold mb-0.5">[3] Replenishment Calculation (MySQL Persist)</p>
                    <p className="text-gray-300">Net Position = OnHand + Inbound - Committed</p>
                    <p className="text-gray-300">Enforces Supplier MOQ &amp; rounds up to Case Multiple</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. System Reliability & Security Section */}
        <section id="reliability" className="py-16 md:py-20 bg-gray-50 border-t border-gray-200 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Enterprise Foundation</h2>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                Built for Operational Reliability
              </p>
              <p className="mt-3 text-sm sm:text-base text-gray-600">
                Strict data integrity and concurrency guarantees protecting store inventory and financial records.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-blue-600 font-bold text-base mb-1.5">Zero Overselling</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Row-level conditional updates and version check tokens prevent inventory race conditions across simultaneous checkouts.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-green-600 font-bold text-base mb-1.5">Supplier Pack Enforcement</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Replenishment proposals respect supplier minimum order quantities and pack multiples, eliminating manual ordering errors.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-purple-600 font-bold text-base mb-1.5">Audited Stock Ledger</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Every inventory change—sales, deliveries, write-offs, or adjustments—is permanently recorded with actor IDs and reasons.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-slate-800 font-bold text-base mb-1.5">Admin-Managed Access</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  User accounts and permission assignments are strictly managed by system administrators in compliance with enterprise policies.
                </p>
              </div>
            </div>

            {/* Sign-in Callout Card */}
            <div className="mt-14 bg-blue-600 rounded-xl p-8 sm:p-10 text-center text-white shadow-md">
              <h3 className="text-xl sm:text-2xl font-extrabold">Ready to access the ORIMS operational dashboard?</h3>
              <p className="mt-2 text-blue-100 max-w-2xl mx-auto text-xs sm:text-sm">
                Sign in with your store credentials to manage products, execute point-of-sale transactions, and review replenishment proposals.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  to="/login"
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-7 py-3 rounded-lg text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                >
                  Sign In to Your Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="bg-white border-t border-gray-200 py-10 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                O
              </div>
              <span className="font-bold text-gray-900 text-sm">ORIMS</span>
              <span className="text-gray-400">| Optimised Retail Inventory Management System</span>
            </div>
            
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs" aria-label="Footer Navigation">
              <a href="#overview" className="hover:text-blue-600 transition-colors">Overview</a>
              <a href="#features" className="hover:text-blue-600 transition-colors">Capabilities</a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">Workflow</a>
              <a href="#ml-forecasting" className="hover:text-blue-600 transition-colors">ML Optimization</a>
              <a href="#reliability" className="hover:text-blue-600 transition-colors">Reliability</a>
              <Link to="/login" className="hover:text-blue-600 transition-colors font-medium text-gray-700">Sign In</Link>
            </nav>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center text-[11px] text-gray-400 gap-2">
            <div>
              Optimised Retail Inventory Management System (ORIMS) • Node.js &amp; MySQL with Python FastAPI ML Service
            </div>
            <div>
              Enterprise Single-Store Architecture
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
