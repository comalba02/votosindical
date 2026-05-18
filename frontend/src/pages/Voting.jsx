import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Users, AlertCircle, Check } from 'lucide-react';
import { API_URL } from '../config';

export default function Voting() {
  const [slates, setSlates] = useState([]);
  const [selectedSlate, setSelectedSlate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('voterToken');
    if (!token) {
      navigate('/');
      return;
    }

    const fetchSlates = async () => {
      try {
        const response = await fetch(`${API_URL}/api/slates`);
        if (!response.ok) throw new Error('Error al cargar las planchas');
        const data = await response.json();
        setSlates(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSlates();
  }, [navigate]);

  const handleVote = async () => {
    if (!selectedSlate) return;
    
    const slateName = slates.find(s => s.id === selectedSlate)?.nombre;

    setModalConfig({
      show: true,
      title: 'CONFIRMAR TU VOTO',
      message: `Has seleccionado la plancha "${slateName}". ¿Estás seguro de tu elección? Esta acción es irreversible.`,
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, show: false }));
        setVoting(true);
        setError('');

        try {
          const token = localStorage.getItem('voterToken');
          const response = await fetch(`${API_URL}/api/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, slate_id: selectedSlate })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Error al registrar el voto');
          }

          setSuccess(true);
          localStorage.removeItem('voterToken');
          
        } catch (err) {
          setError(err.message);
          setVoting(false);
        }
      }
    });
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100 animate-zoom-in">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">¡Voto Registrado!</h2>
        <p className="text-slate-500 max-w-md font-medium">
          Tu voto ha sido procesado exitosamente de forma secreta y segura. Gracias por participar en la elección.
        </p>
        <div className="flex gap-4 mt-10">
          <button 
            onClick={() => navigate('/results')}
            className="px-8 py-4 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl hover:bg-slate-900 hover:-translate-y-1 active:scale-95"
          >
            Resultados en vivo
          </button>
          <button 
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin shadow-xl"></div>
        <div className="text-center animate-pulse">
          <h3 className="text-xl font-bold text-slate-700">Cargando tu papeleta...</h3>
          <p className="text-slate-500 text-sm">Validando acceso seguro</p>
        </div>
      </div>
    );
  }

  if (error && slates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 border border-red-100 shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Error de Conexión</h2>
        <p className="text-slate-500 max-w-sm mb-8">
          No pudimos cargar las opciones de votación. Esto puede deberse a una conexión inestable o saturación del servidor.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-4">
      <header className="mb-12 text-center animate-fade-in-up">
        <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tighter">Elecciones Sindicales</h1>
        <p className="text-slate-500 font-medium">Selecciona la plancha de tu preferencia y emite tu voto de forma segura</p>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 rounded-2xl flex items-center gap-3 border border-red-100 animate-shake">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {slates.map((slate) => (
          <div 
            key={slate.id}
            onClick={() => setSelectedSlate(slate.id)}
            className={`
              relative flex flex-col p-8 rounded-[2.5rem] cursor-pointer transition-all duration-300 border-2 overflow-hidden group
              ${selectedSlate === slate.id 
                ? 'border-blue-600 bg-blue-50/30 shadow-2xl shadow-blue-100 -translate-y-2' 
                : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:-translate-y-1'}
            `}
          >
            {selectedSlate === slate.id && (
              <div className="absolute top-6 right-6 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center animate-zoom-in shadow-lg shadow-blue-200">
                <Check className="w-5 h-5 text-white" />
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{slate.nombre}</h3>
              {slate.descripcion && <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2">{slate.descripcion}</p>}
            </div>

            <div className="flex-grow pt-4 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Candidatos de Plancha
              </h4>
              <ul className="space-y-4">
                {slate.candidates.map(candidate => (
                  <li key={candidate.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-sm shrink-0">
                      {candidate.foto_url ? (
                        <img src={candidate.foto_url} alt={candidate.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-lg bg-slate-50">
                          {candidate.nombre.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-none mb-1">{candidate.nombre}</p>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{candidate.cargo}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Sección de Confirmación Integrada en la Página */}
      <div className="mt-10 animate-fade-in-up">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">Tu selección final</h3>
              {selectedSlate ? (
                <div className="flex items-center gap-4 justify-center md:justify-start">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-black tracking-tight leading-none">
                      {slates.find(s => s.id === selectedSlate)?.nombre}
                    </p>
                    <p className="text-blue-400 text-xs font-bold mt-1 uppercase tracking-widest">Plancha Seleccionada</p>
                  </div>
                </div>
              ) : (
                <p className="text-xl font-bold text-slate-400 italic">No has seleccionado ninguna opción aún</p>
              )}
            </div>
            
            <button
              onClick={handleVote}
              disabled={!selectedSlate || voting}
              className={`
                w-full md:w-auto px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4
                ${!selectedSlate 
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xl shadow-blue-500/40 hover:-translate-y-1 active:scale-95'}
              `}
            >
              {voting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Emitir Voto Secreto
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-slate-400 text-xs font-medium">
          * Tu voto es 100% anónimo y está protegido por cifrado de extremo a extremo.
        </p>
      </div>

      {/* Modal de Confirmación de Voto */}
      {modalConfig.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
          ></div>
          <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-md w-full overflow-hidden relative z-10 animate-zoom-in border border-white/20">
            <div className="p-10 text-center bg-blue-50/30">
              <div className="w-24 h-24 rounded-[2.5rem] bg-white mx-auto flex items-center justify-center mb-8 shadow-2xl shadow-blue-100 text-blue-600">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter">¿CONFIRMAR VOTO?</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-6">Esta acción registrará tu voto de forma definitiva y no podrá ser cambiada.</p>
              
              <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Has elegido:</p>
                <p className="text-xl font-black text-blue-600 tracking-tight">
                  {slates.find(s => s.id === selectedSlate)?.nombre}
                </p>
              </div>
            </div>
            
            <div className="p-10 flex flex-col gap-4">
              <button 
                onClick={modalConfig.onConfirm}
                className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95"
              >
                Sí, Emitir Mi Voto
              </button>
              <button 
                onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Volver a revisar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
