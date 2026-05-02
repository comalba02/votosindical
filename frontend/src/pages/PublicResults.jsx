import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, RefreshCcw, ArrowLeft, TrendingUp } from 'lucide-react';
import { API_URL } from '../config';

export default function PublicResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchResults = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/api/results`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // Refresh automático cada 30 segundos
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const { results, totalVotes, totalElectors } = data;
  const missingVotes = totalElectors - totalVotes;
  const participationRate = totalElectors > 0 ? ((totalVotes / totalElectors) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </button>
        
        <button 
          onClick={fetchResults}
          disabled={refreshing}
          className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar ahora
        </button>
      </div>

      <header className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Resultados en Tiempo Real</h1>
        <p className="text-slate-500">Monitoreo en vivo de la participación y tendencias de la elección.</p>
      </header>

      {/* Tarjetas de Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Censo Electoral</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-800">{totalElectors}</h3>
            <Users className="w-8 h-8 text-slate-200" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Votos Emitidos</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-800">{totalVotes}</h3>
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">{participationRate}%</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Votos Faltantes</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-800">{missingVotes}</h3>
            <BarChart3 className="w-8 h-8 text-slate-200" />
          </div>
        </div>
      </div>

      {/* Gráfico de Resultados por Plancha */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Conteo por Plancha</h2>
        </div>
        <div className="p-8">
          {results.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No hay planchas registradas.
            </div>
          ) : (
            <div className="space-y-8">
              {results.map((r, index) => {
                const percentage = totalVotes > 0 ? ((r.votos / totalVotes) * 100).toFixed(1) : 0;
                // Colores alternados para las barras
                const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-sky-500'];
                const colorClass = colors[index % colors.length];

                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded text-xs font-bold text-slate-500">{index + 1}</span>
                        <h4 className="font-bold text-slate-700">{r.nombre}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-slate-800">{r.votos}</span>
                        <span className="text-sm text-slate-400 ml-2">votos ({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-4">
                      <div 
                        className={`${colorClass} h-full rounded-full transition-all duration-1000 ease-out shadow-sm`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>

                    {/* Candidatos de la Plancha */}
                    <div className="flex flex-wrap gap-4 px-2">
                      {r.candidates && r.candidates.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full shadow-sm">
                          <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                            {c.foto_url ? (
                              <img src={c.foto_url} alt={c.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-400">
                                {c.nombre.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-700 leading-none">{c.nombre}</p>
                            <p className="text-[8px] text-slate-400 leading-tight">{c.cargo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-medium italic">
          <span>* Los resultados se actualizan automáticamente cada 30 segundos.</span>
          <span>Última actualización: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
