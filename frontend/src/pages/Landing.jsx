import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-blue-500 selection:text-white">
      {/* 1. Public Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">Key Capabilities</a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
              <a href="#ml-forecasting" className="hover:text-blue-600 transition-colors">ML Optimization</a>
              <a href="#benefits" className="hover:text-blue-600 transition-colors">Benefits</a>
            </nav>

            {/* Header Actions */}
            <div className="hidden sm:flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-xs text-gray-500">
                    Signed in as <strong className="text-gray-800">{user.name}</strong> ({user.role})
                  </span>
                  <Link
                    to="/dashboard"
                    className="btn-primary text-sm inline-flex items-center space-x-1.5 py-2 px-4 shadow-sm"
                  >
                    <span>Go to Dashboard</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 transition-colors"
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
                aria-label="Toggle Navigation"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
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
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-gray-700 hover:text-blue-600 py-1"
            >
              Benefits
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
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-gray-50 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-6">
                <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
                <span>Optimised Retail Inventory Management System</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Intelligent Inventory, Checkout &amp; ML Replenishment
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
                ORIMS unifies product catalogue management, point of sale checkout, purchase order receiving, and machine learning demand forecasting to eliminate stockouts and optimize retail operations.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/login"
                  className="btn-primary text-base font-semibold px-8 py-3.5 shadow-md shadow-blue-600/20 inline-flex items-center justify-center space-x-2"
                >
                  <span>Get Started with ORIMS</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="#features"
                  className="btn-secondary text-base font-semibold px-6 py-3.5 inline-flex items-center justify-center text-gray-700 hover:text-gray-900"
                >
                  Explore Capabilities
                </a>
              </div>
            </div>

            {/* Illustrative Operational Dashboard Preview */}
            <div className="mt-14 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                {/* Mock Browser/Window Header */}
                <div className="bg-gray-100/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="ml-2 text-xs font-mono text-gray-500">app.orims.local/dashboard</span>
                  </div>
                  <div className="inline-flex items-center space-x-1.5 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span>Backend &amp; ML Service Active</span>
                  </div>
                </div>

                {/* Dashboard Snapshot Cards */}
                <div className="p-6 sm:p-8 bg-gray-50/50 space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Total Products</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
                      <p className="text-xs text-blue-600 mt-1">Catalog Active</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Inventory Valuation</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">$4,120.50</p>
                      <p className="text-xs text-gray-500 mt-1">Unit Cost Basis</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Checkout Protection</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">Atomic</p>
                      <p className="text-xs text-green-600 mt-1">Zero Overselling</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">ML Forecast Horizon</p>
                      <p className="text-2xl font-bold text-purple-600 mt-1">7 Days</p>
                      <p className="text-xs text-purple-600 mt-1">FastAPI Inference</p>
                    </div>
                  </div>

                  {/* Operational Preview Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Simulated 7-day Demand Forecast Bar Representation */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">7-Day Demand Forecast by SKU</h4>
                          <p className="text-xs text-gray-500">Estimated units per day based on historical sales velocity</p>
                        </div>
                        <span className="badge badge-blue">Linear Model</span>
                      </div>
                      <div className="h-40 flex items-end justify-between gap-3 pt-6 px-2">
                        {[
                          { day: 'Day 1', val: 65, units: 13 },
                          { day: 'Day 2', val: 75, units: 15 },
                          { day: 'Day 3', val: 90, units: 18 },
                          { day: 'Day 4', val: 80, units: 16 },
                          { day: 'Day 5', val: 100, units: 20 },
                          { day: 'Day 6', val: 110, units: 22 },
                          { day: 'Day 7', val: 95, units: 19 },
                        ].map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-gray-700 mb-1">{d.units}</span>
                            <div
                              className="w-full max-w-[36px] bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                              style={{ height: `${d.val}%` }}
                            ></div>
                            <span className="text-[11px] text-gray-500 mt-2 font-medium">{d.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Replenishment Constraints Preview */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900">Replenishment Engine</h4>
                          <span className="badge badge-green">Node.js Engine</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                          Automated target stock calculations enforce supplier constraints before order submission.
                        </p>
                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between p-2 rounded bg-gray-50 border border-gray-100">
                            <span className="text-gray-600">Net Position (IP):</span>
                            <span className="font-semibold text-gray-900">OnHand + Inbound - Reserved</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-gray-50 border border-gray-100">
                            <span className="text-gray-600">Supplier MOQ:</span>
                            <span className="font-semibold text-gray-900">Enforced Minimums</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-gray-50 border border-gray-100">
                            <span className="text-gray-600">Pack Multiples:</span>
                            <span className="font-semibold text-gray-900">Rounded Up to Case</span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                        <span>Status: Reorder Ready</span>
                        <span className="font-medium text-blue-600">Draft PO Output</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Key Capabilities Section */}
        <section id="features" className="py-20 bg-white border-t border-gray-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Comprehensive Functionality</h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">
                Engineered for Modern Retail Inventory
              </p>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Built strictly to specification across cataloguing, sales transactions, receiving, and financial auditing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Catalogue &amp; SKU Control</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Unique SKU indexing, optional barcode lookup, category taxonomies, cost price margins, unit of measure tagging, and soft deactivation states.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">POS &amp; Atomic Checkout</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Cart validation, server-side sales tax, idempotency replay tokens, and row-level database conditional updates preventing overselling during concurrent checkouts.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Purchasing &amp; Receiving</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Complete order state machine (Draft, Submitted, Partially Received, Received, Cancelled). Supports partial goods delivery, batch tracking, and delivery receipts.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Stock Movement Ledger</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Immutable audit trail capturing all sales deductions, purchase receipts, adjustments, damage write-offs, and returns with mandatory reasons and user actor IDs.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Returns &amp; Refunds</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Refund handling with distinct restock versus damaged write-off accounting. Enforces refundable boundaries and updates original sales status to Refunded.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="card p-6 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Valuation &amp; Turnover Reports</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Financial reporting on sales revenue and gross profits, inventory valuation computed as unit cost multiplied by on-hand quantity, and COGS turnover velocity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="py-20 bg-gray-50 border-t border-gray-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">End-to-End Workflow</h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">
                How ORIMS Operates
              </p>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                A seamless operational cycle from inventory intake to intelligent replenishment.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4">
                  1
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Configure &amp; Track</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Register products, set safety stocks, and link suppliers with lead time days, minimum order quantities (MOQ), and pack size multiples.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4">
                  2
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Transact &amp; Ledger</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Record point-of-sale customer checkouts and supplier delivery receipts atomically into the immutable inventory stock ledger.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4">
                  3
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Forecast Demand</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The Python FastAPI ML engine extracts lag-7, lag-14, and rolling average features to produce 7-day predicted demand horizons.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4">
                  4
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Optimize &amp; Replenish</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The Node.js engine computes net inventory position, applies MOQ and pack rounding, and generates purchase orders for manager approval.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. ML Forecasting & Architecture Explanation */}
        <section id="ml-forecasting" className="py-20 bg-white border-t border-gray-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
                  <span>FastAPI + Scikit-Learn + Node.js Engine</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Transparent, Constrained Machine Learning Optimization
                </h2>
                <p className="text-base text-gray-600 leading-relaxed">
                  ORIMS cleanly separates machine learning inference from inventory business logic. The Python FastAPI service calculates 7-day demand projections based on historical sales velocity and lag features.
                </p>
                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Documented Fallback Strategy:</strong> If product sales history is insufficient or the ML service is unreachable, Node.js automatically falls back to moving average estimates so core operations never stall.
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Supplier Constraint Application:</strong> Raw suggested order quantities are automatically adjusted for supplier lead times, minimum order quantities (MOQ), and standard pack multiples.
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-gray-900">Human-in-the-Loop Governance:</strong> Recommendations are presented for store manager review. Approval generates a draft purchase order; rejection records an audited reason.
                    </div>
                  </div>
                </div>
              </div>

              {/* Architecture Representation Box */}
              <div className="mt-10 lg:mt-0 lg:col-span-6">
                <div className="bg-gray-900 text-gray-100 p-6 sm:p-8 rounded-2xl shadow-xl font-mono text-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800 text-gray-400">
                    <span>ARCHITECTURE DATA FLOW</span>
                    <span>PORT 8000 &harr; PORT 3001</span>
                  </div>
                  <div className="p-3 rounded bg-gray-800/80 border border-gray-700">
                    <p className="text-blue-400 font-semibold mb-1">[1] Node.js Backend (Port 3001)</p>
                    <p className="text-gray-300">Queries sales transactions &amp; extracts 14-day lag features</p>
                  </div>
                  <div className="text-center text-gray-500 font-bold">&darr; HTTP POST /forecast (Bearer Token Auth)</div>
                  <div className="p-3 rounded bg-gray-800/80 border border-gray-700">
                    <p className="text-purple-400 font-semibold mb-1">[2] FastAPI ML Service (Port 8000)</p>
                    <p className="text-gray-300">Executes model inference &amp; projects 7-day multi-step demand curve</p>
                  </div>
                  <div className="text-center text-gray-500 font-bold">&darr; Returns JSON Predicted Units Array</div>
                  <div className="p-3 rounded bg-gray-800/80 border border-gray-700">
                    <p className="text-green-400 font-semibold mb-1">[3] Replenishment Computation (MySQL Persist)</p>
                    <p className="text-gray-300">Net Position = OnHand + Inbound - Committed</p>
                    <p className="text-gray-300">Enforces Supplier MOQ &amp; rounds up to Pack Multiple</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Operational Benefits Section */}
        <section id="benefits" className="py-20 bg-gray-50 border-t border-gray-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Tangible Outcomes</h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">
                Designed for Operational Reliability
              </p>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Built to solve the real daily friction points of inventory management without arbitrary assumptions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-blue-600 font-bold text-lg mb-2">Zero Overselling</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Conditional row-level inventory checks prevent race conditions and overselling even when multiple cashiers submit simultaneous checkouts.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-green-600 font-bold text-lg mb-2">Working Capital Safety</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Replenishment proposals factor in supplier MOQ and pack sizes, eliminating costly order rounding mistakes and preventing over-accumulation.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-purple-600 font-bold text-lg mb-2">Audit Traceability</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Every inventory change—whether received from a supplier, sold at POS, adjusted for damage, or returned—is immutably recorded with actor timestamps.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-orange-600 font-bold text-lg mb-2">Role-Based Security</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Fine-grained permissions enforce that cashiers access POS, inventory staff receive purchase orders, and managers approve optimizations.
                </p>
              </div>
            </div>

            {/* Ready to start CTA Banner */}
            <div className="mt-16 bg-blue-600 rounded-2xl p-8 sm:p-12 text-center text-white shadow-lg shadow-blue-500/20">
              <h3 className="text-2xl sm:text-3xl font-extrabold">Ready to access the ORIMS operational dashboard?</h3>
              <p className="mt-3 text-blue-100 max-w-2xl mx-auto text-sm sm:text-base">
                Sign in with your store credentials to manage products, execute point-of-sale transactions, and review replenishment recommendations.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  to="/login"
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3.5 rounded-lg text-base shadow-sm transition-colors"
                >
                  Sign In to Your Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 text-sm text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                O
              </div>
              <span className="font-bold text-gray-900">ORIMS</span>
              <span className="text-xs text-gray-400">| Optimised Retail Inventory Management System</span>
            </div>
            <div className="flex space-x-6 text-xs">
              <a href="#features" className="hover:text-blue-600 transition-colors">Capabilities</a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">Workflow</a>
              <a href="#ml-forecasting" className="hover:text-blue-600 transition-colors">Machine Learning</a>
              <a href="#benefits" className="hover:text-blue-600 transition-colors">Benefits</a>
              <Link to="/login" className="hover:text-blue-600 transition-colors font-medium text-gray-700">Sign In</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Optimised Retail Inventory Management System (ORIMS). All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
