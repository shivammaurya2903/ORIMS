import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">404</h1>
          <h2 className="text-xl font-bold text-gray-800 mt-2">Page Not Found</h2>
          <p className="mt-2 text-sm text-gray-600">
            The page you requested could not be found. Please check the URL or return to home.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="btn-secondary text-sm inline-flex justify-center items-center py-2 px-4"
          >
            Go to Landing Page
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="btn-primary text-sm inline-flex justify-center items-center py-2 px-4"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="btn-primary text-sm inline-flex justify-center items-center py-2 px-4"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
