import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Vote, LogOut, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');
  const token = localStorage.getItem(isAdminPath ? 'adminToken' : 'voterToken');

  const handleLogout = () => {
    localStorage.removeItem(isAdminPath ? 'adminToken' : 'voterToken');
    localStorage.removeItem('voterInfo');
    navigate(isAdminPath ? '/admin' : '/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight transition-transform hover:scale-105 active:scale-95">
          <Vote className="w-6 h-6 text-blue-600" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">VotoSindical</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {token ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors px-3 py-2 rounded-md hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          ) : (
            <div className="flex items-center gap-4">
              {location.pathname !== '/' && (
                <Link 
                  to="/" 
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors"
                >
                  Inicio
                </Link>
              )}
              <Link 
                to="/results" 
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors"
              >
                Resultados
              </Link>
              {!isAdminPath && (
                <Link 
                  to="/admin" 
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
