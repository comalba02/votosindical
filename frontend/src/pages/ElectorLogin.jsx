import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function ElectorLogin() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { urlToken } = useParams();

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    } else {
      const params = new URLSearchParams(location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        setToken(tokenParam);
      }
    }
  }, [location, urlToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!token.trim()) {
      setError('Por favor, ingresa tu código de acceso.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al validar el código');
      }

      localStorage.setItem('voterToken', token.trim());
      localStorage.setItem('voterInfo', JSON.stringify(data.voter));
      navigate('/vote');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all border border-slate-100">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Acceso a Votación</h2>
          <p className="text-blue-100 text-sm">Ingresa tu código único para participar</p>
        </div>
        
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700 mb-2">
                Código de Acceso
              </label>
              <input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Ej. a1b2c3d4-..."
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-slate-900 placeholder:text-slate-400"
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Ingresar y Votar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
            <p>Tu voto es secreto y está protegido por encriptación.</p>
            <p>Si tienes problemas, contacta a la comisión electoral.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
