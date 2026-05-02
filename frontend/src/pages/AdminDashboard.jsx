import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Plus, 
  Trash2, 
  LogOut, 
  BarChart3,
  TrendingUp,
  Download,
  Upload,
  AlertCircle,
  RotateCcw,
  Lock,
  Mail,
  ShieldCheck,
  BookOpen,
  FolderTree,
  Code
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL } from '../config';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('results');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState({});
  const [selectedSlate, setSelectedSlate] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);
  const [candidateModal, setCandidateModal] = useState({ show: false, slateId: null });
  const [modalConfig, setModalConfig] = useState({ 
    show: false, 
    type: '', 
    title: '', 
    message: '', 
    onConfirm: null, 
    requireInput: false, 
    inputValue: '', 
    confirmWord: '' 
  });
  const [restoreFile, setRestoreFile] = useState(null);
  const navigate = useNavigate();

  const showAlert = (title, message, type = 'info') => {
    setModalConfig({
      show: true,
      type,
      title,
      message,
      requireInput: false,
      onConfirm: () => setModalConfig(prev => ({ ...prev, show: false })),
    });
  };

  const token = localStorage.getItem('adminToken');
  
  const currentSlate = (candidateModal.show && Array.isArray(data)) 
    ? data.find(s => s.id === candidateModal.slateId) 
    : null;

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    if (activeTab !== 'documentation') {
      fetchData();
    }
  }, [activeTab, navigate, token]);

  const fetchData = async (forceLoading = false) => {
    if (activeTab === 'documentation') return;
    
    if (!cache[activeTab] || forceLoading) {
      setLoading(true);
      setData(null);
    } else {
      setData(cache[activeTab]);
    }

    try {
      const endpoints = {
        results: '/api/results',
        slates: '/api/admin/slates',
        voters: '/api/admin/voters',
        settings: '/api/settings',
        positions: '/api/admin/positions'
      };
      
      const options = activeTab === 'results' ? {} : { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await fetch(`${API_URL}${endpoints[activeTab]}`, options);
      
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('adminToken');
        navigate('/admin');
        return;
      }
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al cargar datos');
      
      setData(result);
      setCache(prev => ({ ...prev, [activeTab]: result }));
      
      // Si estamos en slates, también cargamos los cargos para los formularios de candidatos
      if (activeTab === 'slates') {
        const pRes = await fetch(`${API_URL}/api/admin/positions`, { headers: { 'Authorization': `Bearer ${token}` } });
        const pData = await pRes.json();
        if (pRes.ok) setCache(prev => ({ ...prev, positions: pData }));
      }
      
      setError(null);
    } catch (err) {
      console.error(err);
      // Reintento automático simple si es un error de conexión (Failed to fetch)
      if (err.message === 'Failed to fetch' && !cache[activeTab]) {
        setTimeout(() => fetchData(forceLoading), 1500);
        return;
      }
      if (!cache[activeTab]) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const invalidateCache = (tab) => {
    setCache(prev => {
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  };

  const generatePDF = async () => {
    try {
      // Necesitamos todos los datos para el reporte
      const [resultsRes, votersRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/results`),
        fetch(`${API_URL}/api/admin/voters`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/settings`)
      ]);
      
      const resultsData = await resultsRes.json();
      const votersData = await votersRes.json();
      const settingsData = await settingsRes.json();
      
      const doc = new jsPDF();
      const now = new Date();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // --- ENCABEZADO PROFESIONAL ---
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Fondo circular blanco para el logo
      doc.setFillColor(255, 255, 255);
      doc.circle(25, 20, 16, 'F');
      
      // Logo si existe
      if (settingsData.logo_base64) {
        try {
          // Ajustar logo más grande (26x26) centrado en el círculo (centro 25,20)
          doc.addImage(settingsData.logo_base64, 'PNG', 12, 7, 26, 26);
        } catch (e) { console.error('Error adding logo to PDF', e); }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(settingsData.union_nombre || 'REPORTE ELECTORAL OFICIAL', pageWidth/2 + 10, 18, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(settingsData.eleccion_nombre || 'Sistema de Voto Sindical Digital', pageWidth/2 + 10, 25, { align: 'center' });
      
      const headerSubtext = [
        settingsData.eleccion_fecha ? `Fecha Elección: ${settingsData.eleccion_fecha}` : null,
        settingsData.email ? `Contacto: ${settingsData.email}` : null
      ].filter(Boolean).join(' | ');
      
      doc.setFontSize(8);
      doc.text(headerSubtext, pageWidth/2 + 10, 31, { align: 'center' });
      
      let currentY = 55;

      // Configuración base para tablas uniformes
      const tableConfig = {
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data) => {
          // Pie de página
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.setFont('helvetica', 'italic');
          doc.text(
            `Reporte generado el: ${now.toLocaleString()} - Página ${doc.internal.getNumberOfPages()}`,
            14,
            pageHeight - 10
          );
        }
      };

      // --- 1. RESUMEN DE PARTICIPACIÓN ---
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Resumen General de Participación', 14, currentY);
      currentY += 5;

      const { totalElectors, totalVotes, results } = resultsData;
      const missingVotes = totalElectors - totalVotes;
      
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [['Métrica de Control', 'Cantidad / Valor']],
        body: [
          ['Total Censo Electoral (Electores Inscritos)', `${totalElectors} personas`],
          ['Votos Emitidos (Participación)', `${totalVotes} votos (${totalElectors > 0 ? ((totalVotes/totalElectors)*100).toFixed(1) : 0}%)`],
          ['Abstención (No han votado)', `${missingVotes} votos (${totalElectors > 0 ? ((missingVotes/totalElectors)*100).toFixed(1) : 0}%)`]
        ]
      });
      currentY = doc.lastAutoTable.finalY + 15;

      // --- 2. GRÁFICA DE RESULTADOS ---
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Gráfica de Votos por Plancha', 14, currentY);
      currentY += 12;

      results.forEach((r, i) => {
        const percentage = totalVotes > 0 ? (r.votos / totalVotes) : 0;
        const barWidth = 140 * percentage;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(r.nombre, 14, currentY);
        
        doc.setFont('helvetica', 'normal');
        doc.text(`${r.votos} votos (${(percentage * 100).toFixed(1)}%)`, 160, currentY);
        currentY += 3;
        
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 140, 6, 'F');
        
        doc.setFillColor(37, 99, 235);
        if (barWidth > 0) doc.rect(14, currentY, barWidth, 6, 'F');
        
        currentY += 12;
        if (currentY > 270) { doc.addPage(); currentY = 20; }
      });

      // --- 3. INTEGRANTES DE LAS PLANCHAS ---
      currentY += 5;
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Integrantes de las Planchas', 14, currentY);
      currentY += 12; // Aumentado para dejar un salto de línea claro

      results.forEach((s) => {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Plancha: ${s.nombre}`, 14, currentY);
        currentY += 2;
        
        autoTable(doc, {
          ...tableConfig,
          startY: currentY + 2,
          head: [['Nombre del Candidato', 'Cargo']],
          body: (s.candidates || []).map(c => [c.nombre, c.cargo]),
          margin: { left: 20 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      });

      // --- 4. LISTADO COMPLETO DEL CENSO ---
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('4. Listado Completo del Censo Electoral', 14, 20);
      
      autoTable(doc, {
        ...tableConfig,
        startY: 25,
        head: [['Nombre', 'Correo Electrónico', 'Estado']],
        body: votersData.map(v => [v.nombre, v.email, v.used ? 'YA VOTÓ' : 'PENDIENTE'])
      });
      
      doc.save(`Reporte_Oficial_Votacion_${now.toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Error:', err);
      showAlert('Error de Reporte', 'No se pudo generar el PDF: ' + err.message, 'danger');
    }
  };

  const generateDataDictionaryPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Diccionario de Datos - VotoSindical', 14, 20);
    
    let currentY = 40;
    const tableConfig = {
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    };

    const tables = [
      {
        name: 'settings (Configuración)',
        columns: [
          ['id', 'INTEGER', 'Primary Key (1)', 'Identificador único'],
          ['union_nombre', 'TEXT', '-', 'Nombre del sindicato'],
          ['eleccion_nombre', 'TEXT', '-', 'Nombre de la elección'],
          ['eleccion_fecha', 'TEXT', '-', 'Fecha programada'],
          ['email', 'TEXT', '-', 'Email de contacto oficial'],
          ['logo_base64', 'TEXT', '-', 'Logo en formato base64'],
          ['smtp_host', 'TEXT', '-', 'Host del servidor SMTP'],
          ['smtp_port', 'INTEGER', '-', 'Puerto SMTP'],
          ['smtp_user', 'TEXT', '-', 'Usuario de correo'],
          ['smtp_pass', 'TEXT', '-', 'Contraseña de aplicación'],
          ['smtp_secure', 'INTEGER', 'Default 1', 'Uso de SSL (1: Sí, 0: No)']
        ]
      },
      {
        name: 'slates (Planchas)',
        columns: [
          ['id', 'INTEGER', 'PK AI', 'ID de la plancha'],
          ['nombre', 'TEXT', '-', 'Nombre de la plancha'],
          ['descripcion', 'TEXT', '-', 'Descripción o lema']
        ]
      },
      {
        name: 'candidates (Candidatos)',
        columns: [
          ['id', 'INTEGER', 'PK AI', 'ID del candidato'],
          ['slate_id', 'INTEGER', 'FK (slates.id)', 'Referencia a la plancha'],
          ['nombre', 'TEXT', '-', 'Nombre del candidato'],
          ['cargo', 'TEXT', '-', 'Cargo al que aspira'],
          ['foto_url', 'TEXT', '-', 'Foto en base64']
        ]
      },
      {
        name: 'voters (Censo Electoral)',
        columns: [
          ['id', 'INTEGER', 'PK AI', 'ID del elector'],
          ['nombre', 'TEXT', '-', 'Nombre completo'],
          ['email', 'TEXT', 'UNIQUE', 'Correo para envío de token'],
          ['token', 'TEXT', 'UNIQUE', 'Código secreto de votación'],
          ['used', 'INTEGER', 'Default 0', 'Estado (0: Pendiente, 1: Votó)'],
          ['timestamp_vote', 'TEXT', '-', 'Fecha y hora del voto']
        ]
      },
      {
        name: 'votes (Urna Electrónica)',
        columns: [
          ['id', 'INTEGER', 'PK AI', 'ID del voto'],
          ['slate_id', 'INTEGER', 'FK (slates.id)', 'Referencia al voto'],
          ['timestamp', 'DATETIME', 'CURRENT_TIMESTAMP', 'Momento del sufragio']
        ]
      }
    ];

    tables.forEach(t => {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Tabla: ${t.name}`, 14, currentY);
      currentY += 4;
      
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [['Columna', 'Tipo', 'Restricción', 'Descripción']],
        body: t.columns
      });
      currentY = doc.lastAutoTable.finalY + 12;
    });

    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(12);
    doc.text('Relaciones del Sistema', 14, currentY);
    autoTable(doc, {
      ...tableConfig,
      startY: currentY + 5,
      head: [['Origen', 'Destino', 'Tipo', 'Acción']],
      body: [
        ['candidates.slate_id', 'slates.id', 'Muchos a Uno', 'ON DELETE CASCADE'],
        ['votes.slate_id', 'slates.id', 'Muchos a Uno', 'ON DELETE CASCADE']
      ]
    });

    doc.save(`Diccionario_Datos_VotoSindical.pdf`);
  };

  const generateDirectoryStructurePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Estructura de Directorios - VotoSindical', 14, 20);
    
    let currentY = 40;
    const tableConfig = {
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    };

    const structure = [
      ['/', 'Raíz del Proyecto', 'Contiene archivos de configuración global y orquestación.'],
      ['/.env', 'Variables de Entorno', 'Configuración de puertos, secretos JWT y URLs de conexión.'],
      ['/package.json', 'Orquestador NPM', 'Gestiona el arranque simultáneo de backend y frontend.'],
      ['/backend', 'Carpeta del Servidor', 'Núcleo del sistema, API y Base de Datos.'],
      ['/backend/index.js', 'Punto de Entrada', 'Define las rutas de la API, lógica de votación y envío de correos.'],
      ['/backend/db.js', 'Gestión de BD', 'Inicializa SQLite, define el esquema y maneja migraciones.'],
      ['/backend/database.sqlite', 'Base de Datos', 'Archivo persistente que contiene toda la información de la elección.'],
      ['/backend/uploads/', 'Carga Temporal', 'Almacén momentáneo para procesar archivos Excel de electores.'],
      ['/frontend', 'Carpeta de Interfaz', 'Código fuente de la aplicación web (React + Vite).'],
      ['/frontend/src/pages/', 'Vistas/Pantallas', 'Contiene AdminDashboard, Voting, PublicResults y Logins.'],
      ['/frontend/src/components/', 'Componentes UI', 'Elementos reutilizables como la Barra de Navegación y el Layout.'],
      ['/frontend/src/config.js', 'Configuración API', 'Define la dirección de comunicación con el backend.'],
      ['/frontend/vite.config.js', 'Configuración Vite', 'Define el comportamiento del servidor de desarrollo y compilación.']
    ];

    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [['Ruta', 'Nombre/Tipo', 'Descripción']],
      body: structure,
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { cellWidth: 40 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 15;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text('Arquitectura del Sistema', 14, currentY);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text([
      'El sistema utiliza una arquitectura desacoplada (Monorepo):',
      '1. El Backend actúa como una API REST independiente.',
      '2. El Frontend es una Single Page Application (SPA) que consume dicha API.',
      '3. La comunicación se realiza mediante peticiones HTTP (Fetch API) y seguridad basada en JWT.'
    ], 14, currentY + 8);

    doc.save(`Estructura_Directorios_VotoSindical.pdf`);
  };

  const generateAPIDocumentationPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado Principal
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Catálogo de API REST - VotoSindical', 14, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Documentación técnica para integración y desarrollo v1.0', 14, 28);
    
    let currentY = 45;
    const tableConfig = {
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    };

    const addSectionTitle = (title) => {
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, currentY);
      currentY += 4;
    };

    const addCodeBlock = (title, code) => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, currentY);
      currentY += 4;
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(code, pageWidth - 28);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, pageWidth - 28, (lines.length * 4) + 4, 'F');
      doc.text(lines, 18, currentY + 4);
      currentY += (lines.length * 4) + 10;
    };

    // --- SECCIÓN 1: RUTAS PÚBLICAS ---
    addSectionTitle('1. Endpoints Públicos (Votantes)');
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [['Método', 'Endpoint', 'Autenticación', 'Descripción']],
      body: [
        ['GET', '/api/settings', 'Libre', 'Datos básicos de la elección (Nombre, Logo).'],
        ['POST', '/api/auth/token', 'Libre', 'Valida el token UUID del votante.'],
        ['GET', '/api/slates', 'Libre', 'Lista planchas y sus candidatos asociados.'],
        ['POST', '/api/vote', 'Voter Token', 'Registra el sufragio anónimo.'],
        ['GET', '/api/results', 'Libre', 'Estadísticas y conteo en tiempo real.']
      ]
    });
    currentY = doc.lastAutoTable.finalY + 10;

    addCodeBlock('Ejemplo: Validar Token (POST /api/auth/token)', 
      'Request:\n{ "token": "uuid-v4-..." }\n\nResponse (200 OK):\n{ "success": true, "voter": { "nombre": "Juan...", "email": "j@..." } }'
    );

    addCodeBlock('Ejemplo: Emitir Voto (POST /api/vote)', 
      'Request:\n{ "token": "uuid-v4-...", "slate_id": 1 }\n\nResponse (200 OK):\n{ "success": true, "message": "Voto registrado..." }'
    );

    // --- SECCIÓN 2: RUTAS DE ADMINISTRACIÓN ---
    doc.addPage(); currentY = 20;
    addSectionTitle('2. Endpoints Administrativos (Requieren JWT)');
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [['Método', 'Endpoint', 'Función Principal', 'Payload Ejemplo']],
      body: [
        ['POST', '/api/admin/login', 'Obtención de Token', '{ "username": "...", "password": "..." }'],
        ['GET', '/api/admin/voters', 'Gestión de Censo', 'Retorna lista de tokens y estado de voto.'],
        ['POST', '/api/admin/voters', 'Crear Elector', '{ "nombre": "...", "email": "..." }'],
        ['POST', '/api/admin/voters/import', 'Importación Masiva', 'Multipart/Form-Data (Archivo .xlsx)'],
        ['POST', '/api/admin/slates', 'Crear Plancha', '{ "nombre": "...", "descripcion": "..." }'],
        ['POST', '/api/admin/candidates', 'Asignar Candidato', '{ "slate_id": 1, "nombre": "...", "cargo": "..." }'],
        ['POST', '/api/admin/settings', 'Configurar Sistema', '{ "union_nombre": "...", "smtp_host": "..." }'],
        ['POST', '/api/admin/reset', 'Borrado Total', 'Ninguno (Acción Irreversible)']
      ]
    });
    currentY = doc.lastAutoTable.finalY + 10;

    addCodeBlock('Ejemplo: Importar Excel (POST /api/admin/voters/import)', 
      'Header: Content-Type: multipart/form-data\nBody: file=@mi_censo.xlsx\n\nResponse (200 OK):\n{ "success": true, "count": 150 }'
    );

    addCodeBlock('Ejemplo: Configurar SMTP (POST /api/admin/settings)', 
      'Body:\n{\n  "union_nombre": "Sinditrabajo",\n  "smtp_host": "smtp.gmail.com",\n  "smtp_port": 587,\n  "smtp_user": "..."\n}\n\nResponse: { "success": true }'
    );

    addCodeBlock('Ejemplo: Cambio de Contraseña (PUT /api/admin/password)', 
      'Body:\n{ "currentPassword": "...", "newPassword": "..." }\n\nResponse: { "success": true, "message": "Actualizada" }'
    );

    doc.addPage(); currentY = 20;
    addSectionTitle('3. Protocolo de Seguridad');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text([
      '- El sistema utiliza JSON Web Tokens (JWT) para la autorización.',
      '- El token tiene una validez de 8 horas.',
      '- Todas las rutas que inician con /api/admin/ deben incluir el encabezado:',
      '  Authorization: Bearer <TU_TOKEN_JWT>',
      '- Las imágenes se envían y reciben en formato Base64 para integridad en la base de datos.'
    ], 14, currentY + 5);

    doc.save(`Documentacion_API_VotoSindical_Completa.pdf`);
  };

  const generateVoter = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const nombre = e.target.nombre.value;
    
    try {
      const response = await fetch(`${API_URL}/api/admin/voters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, nombre })
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Error desconocido al crear elector');
      }

      e.target.reset();
      invalidateCache('voters');
      fetchData();
    } catch (err) {
      showAlert('Error de Registro', 'No se pudo crear el elector: ' + err.message, 'danger');
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const settings = { ...data }; // Mantener valores actuales para no sobrescribir con null
    
    // Actualizar solo los campos presentes en el formulario actual
    formData.forEach((value, key) => {
      if (key === 'smtp_port') settings[key] = parseInt(value) || 0;
      else if (key === 'smtp_secure') settings[key] = 1;
      else settings[key] = value;
    });

    // Manejo especial de checkbox (si no está marcado, no viene en formData)
    if (e.target.name === 'smtp_form' || e.target.querySelector('[name="smtp_host"]')) {
      if (!formData.has('smtp_secure')) settings.smtp_secure = 0;
    }

    const logoFile = e.target.logo?.files?.[0];
    if (logoFile) {
      try {
        settings.logo_base64 = await fileToBase64(logoFile);
      } catch (err) {
        showAlert('Error de Imagen', 'No se pudo procesar el logo seleccionado', 'danger');
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (response.ok) {
        showAlert('Éxito', 'Configuración guardada correctamente', 'info');
        invalidateCache('settings');
        fetchData();
      }
    } catch (err) {
      showAlert('Error de Guardado', 'No se pudo guardar la configuración', 'danger');
    }
  };

  const downloadBackup = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/backup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al descargar backup');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_votacion_${new Date().toISOString().split('T')[0]}.sqlite`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showAlert('Error de Backup', 'No se pudo descargar la copia de seguridad: ' + err.message, 'danger');
    }
  };

  const resetSystem = () => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'BORRADO TOTAL DEL SISTEMA',
      message: 'Esta acción eliminará permanentemente TODOS los votos, candidatos, planchas y electores. El sistema volverá a cero e iniciará una nueva base de datos limpia.',
      requireInput: true,
      confirmWord: 'CONFIRMADO',
      inputValue: '',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/admin/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            setCache({}); // Invalida TODO el cache en un reset
            setActiveTab('results');
            fetchData(true);
          }
        } catch (err) {
          showAlert('Error de Reset', 'No se pudo resetear el sistema', 'danger');
        }
      }
    });
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setModalConfig({
      show: true,
      type: 'info',
      title: 'RESTAURAR BASE DE DATOS',
      message: `¿Estás seguro de que deseas restaurar la copia "${file.name}"? Esto SOBRESCRIBIRÁ todos los datos actuales (votos, candidatos, electores y configuración).`,
      requireInput: false,
      onConfirm: async () => {
        const formData = new FormData();
        formData.append('database', file);

        try {
          const response = await fetch(`${API_URL}/api/admin/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
          
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            setCache({}); // Invalida TODO en restauración
            fetchData(true);
          } else {
            const result = await response.json();
            alert('Error al restaurar: ' + result.error);
          }
        } catch (err) {
          alert('Error de conexión al restaurar');
        }
      }
    });
    e.target.value = '';
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/voters/template`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_electores.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showAlert('Error de Descarga', 'No se pudo bajar la plantilla de Excel', 'danger');
    }
  };

  const importVoters = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/admin/voters/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await response.json();
      if (response.ok) {
        showAlert('Importación Exitosa', `${result.count} electores procesados correctamente.`, 'info');
        invalidateCache('voters');
        fetchData();
      } else {
        showAlert('Error de Importación', 'Hubo un fallo al subir el archivo: ' + result.error, 'danger');
      }
    } catch (err) {
      showAlert('Error de Conexión', 'No se pudo establecer contacto con el servidor para importar', 'danger');
    }
    e.target.value = '';
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const createCandidate = async (e, slate_id) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    const cargo = e.target.cargo.value;
    const fotoFile = e.target.foto_file.files[0];
    
    let foto_url = '';
    if (fotoFile) {
      try {
        foto_url = await fileToBase64(fotoFile);
      } catch (err) {
        showAlert('Error de Imagen', 'No se pudo procesar la fotografía del candidato', 'danger');
        return;
      }
    }
    
    try {
      await fetch(`${API_URL}/api/admin/candidates`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slate_id, nombre, cargo, foto_url })
      });
      e.target.reset();
      invalidateCache('slates');
      fetchData();
    } catch (err) {
      showAlert('Error de Candidato', 'No se pudo registrar el candidato en el sistema', 'danger');
    }
  };

  const updateCandidate = async (e, id, current_foto_url) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    const cargo = e.target.cargo.value;
    const fotoFile = e.target.foto_file.files[0];
    
    let foto_url = current_foto_url || '';
    if (fotoFile) {
      try {
        foto_url = await fileToBase64(fotoFile);
      } catch (err) {
        showAlert('Error de Imagen', 'No se pudo procesar la fotografía seleccionada', 'danger');
        return;
      }
    }
    
    try {
      await fetch(`${API_URL}/api/admin/candidates/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre, cargo, foto_url })
      });
      setEditingCandidate(null);
      invalidateCache('slates');
      fetchData();
    } catch (err) {
      showAlert('Error de Actualización', 'No se pudo modificar los datos del candidato', 'danger');
    }
  };

  const deleteCandidate = async (id) => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'Eliminar Candidato',
      message: '¿Estás seguro de que deseas eliminar este candidato de la plancha? Esta acción no se puede deshacer.',
      requireInput: false,
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/admin/candidates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setModalConfig(prev => ({ ...prev, show: false }));
          invalidateCache('slates');
          fetchData();
        } catch (err) {
          showAlert('Error de Eliminación', 'No se pudo borrar el candidato', 'danger');
        }
      }
    });
  };

  const createSlate = async (e) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    const descripcion = e.target.descripcion.value;
    
    try {
      await fetch(`${API_URL}/api/admin/slates`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre, descripcion })
      });
      e.target.reset();
      invalidateCache('slates');
      fetchData();
    } catch (err) {
      showAlert('Error de Plancha', 'No se pudo crear la nueva plancha electoral', 'danger');
    }
  };

  const deleteAllVoters = () => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'BORRAR TODOS LOS ELECTORES',
      message: 'Esta acción eliminará permanentemente a TODOS los electores y sus tokens de votación. También se invalidarán los votos actuales.',
      requireInput: true,
      confirmWord: 'CONFIRMADO',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/admin/voters`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            invalidateCache('voters');
            fetchData();
          }
        } catch (err) {
          showAlert('Error', 'No se pudieron borrar los electores', 'danger');
        }
      }
    });
  };

  const deleteAllSlates = () => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'BORRAR TODAS LAS PLANCHAS',
      message: 'Esta acción eliminará permanentemente TODAS las planchas, sus candidatos y los votos emitidos hasta el momento.',
      requireInput: true,
      confirmWord: 'CONFIRMADO',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/admin/slates`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            invalidateCache('slates');
            fetchData();
          }
        } catch (err) {
          showAlert('Error', 'No se pudieron borrar las planchas', 'danger');
        }
      }
    });
  };

  const resetVoting = () => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'REINICIAR VOTACIÓN GLOBAL',
      message: 'Esta acción eliminará TODOS los votos registrados hasta ahora y permitirá que TODOS los electores puedan votar nuevamente. Las planchas y electores se mantendrán intactos.',
      requireInput: true,
      confirmWord: 'CONFIRMADO',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/admin/votes/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            invalidateCache('voters');
            invalidateCache('results');
            fetchData();
            showAlert('Reinicio Exitoso', 'La votación ha vuelto a cero y el censo ha sido habilitado.', 'info');
          }
        } catch (err) {
          showAlert('Error', 'No se pudo reiniciar la votación', 'danger');
        }
      }
    });
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'Las contraseñas nuevas no coinciden', 'danger');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/password`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const resData = await response.json();
      if (response.ok) {
        showAlert('Éxito', 'Contraseña actualizada correctamente', 'info');
        e.target.reset();
      } else {
        showAlert('Error', resData.error || 'No se pudo actualizar la contraseña', 'danger');
      }
    } catch (err) {
      showAlert('Error', 'Error de conexión con el servidor', 'danger');
    }
  };

  const sendTokensByEmail = async () => {
    setModalConfig({
      show: true,
      type: 'info',
      title: 'ENVIAR TOKENS POR EMAIL',
      message: '¿Estás seguro de que deseas enviar los tokens de votación a TODOS los electores que aún no han votado? Asegúrate de haber configurado correctamente el servidor SMTP en los ajustes.',
      requireInput: true,
      confirmWord: 'CONFIRMADO',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/admin/voters/send-emails`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const resData = await response.json();
          if (response.ok) {
            setModalConfig(prev => ({ ...prev, show: false }));
            showAlert('Envío Completado', `Se enviaron ${resData.sentCount} correos exitosamente. Errores: ${resData.failCount}`, 'info');
          } else {
            showAlert('Error de Envío', resData.error || 'No se pudo procesar el envío de correos', 'danger');
          }
        } catch (err) {
          showAlert('Error', 'Error de conexión con el servidor de correo', 'danger');
        }
      }
    });
  };
  
  const createPosition = async (e) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    try {
      await fetch(`${API_URL}/api/admin/positions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre })
      });
      e.target.reset();
      invalidateCache('positions');
      fetchData();
    } catch (err) {
      showAlert('Error', 'No se pudo crear el cargo', 'danger');
    }
  };

  const updatePosition = async (e, id) => {
    e.preventDefault();
    const nombre = e.target.nombre.value;
    try {
      await fetch(`${API_URL}/api/admin/positions/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre })
      });
      setEditingPosition(null);
      invalidateCache('positions');
      fetchData();
    } catch (err) {
      showAlert('Error', 'No se pudo actualizar el cargo', 'danger');
    }
  };

  const deletePosition = async (id) => {
    setModalConfig({
      show: true,
      type: 'danger',
      title: 'Eliminar Cargo',
      message: '¿Estás seguro de que deseas eliminar este cargo? Esto no afectará a los candidatos que ya lo tienen asignado, pero no estará disponible para nuevos registros.',
      requireInput: false,
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/admin/positions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setModalConfig(prev => ({ ...prev, show: false }));
          invalidateCache('positions');
          fetchData();
        } catch (err) {
          showAlert('Error', 'No se pudo eliminar el cargo', 'danger');
        }
      }
    });
  };

  const renderContent = () => {
    if (error) return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="font-medium">{error}</p>
        <button onClick={fetchData} className="mt-4 text-sm bg-red-600 text-white px-4 py-2 rounded-lg">Reintentar</button>
      </div>
    );

    if (loading) return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-pulse">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em] animate-bounce">Sincronizando con el servidor...</p>
      </div>
    );

    if (activeTab === 'results') {
      // Validamos que data sea el objeto de resultados y no un array de otra pestaña
      if (!data || Array.isArray(data) || !data.results) {
        return <div className="p-8 text-center text-slate-500">Cargando estadísticas de resultados...</div>;
      }
      
      const { results, totalVotes, totalElectors } = data;
      const missingVotes = totalElectors - totalVotes;
      const participationRate = totalElectors > 0 ? ((totalVotes / totalElectors) * 100).toFixed(1) : 0;

      return (
        <div className="space-y-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Estado de la Elección
            </h2>
            <button 
              onClick={generatePDF}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-all shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              Descargar Reporte PDF
            </button>
          </div>

          {/* Tarjetas de Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Censo Total</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-800">{totalElectors}</h3>
                <Users className="w-8 h-8 text-slate-100" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Votos Emitidos</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-800">{totalVotes}</h3>
                <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">{participationRate}%</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Abstención</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-800">{missingVotes}</h3>
                <BarChart3 className="w-8 h-8 text-slate-100" />
              </div>
            </div>
          </div>

          {/* Listado de Planchas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700">Conteo Detallado</h3>
            </div>
            <div className="p-8">
              {results.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">No hay planchas registradas.</div>
              ) : (
                <div className="space-y-10">
                  {results.map((r, index) => {
                    const percentage = totalVotes > 0 ? ((r.votos / totalVotes) * 100).toFixed(1) : 0;
                    const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600'];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={r.id} className="group">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-sm font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">{index + 1}</span>
                            <h4 className="font-extrabold text-slate-800 text-lg">{r.nombre}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-slate-900">{r.votos}</span>
                            <span className="text-xs font-bold text-slate-400 ml-2 uppercase tracking-tighter">votos ({percentage}%)</span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-6 shadow-inner">
                          <div 
                            className={`${colorClass} h-full rounded-full transition-all duration-1000 ease-out shadow-md`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>

                        {/* Candidatos */}
                        <div className="flex flex-wrap gap-3 px-2">
                          {r.candidates && r.candidates.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 pr-4 pl-1.5 py-1.5 rounded-full hover:bg-white hover:shadow-sm transition-all">
                              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                                {c.foto_url ? (
                                  <img src={c.foto_url} alt={c.nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400">
                                    {c.nombre.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-slate-700 leading-none">{c.nombre}</p>
                                <p className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5">{c.cargo}</p>
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
          </div>
        </div>
      );
    }

    if (activeTab === 'slates') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nueva Plancha
              </h3>
              <form onSubmit={createSlate} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Nombre</label>
                  <input name="nombre" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Descripción</label>
                  <textarea name="descripcion" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition">
                  Guardar Plancha
                </button>
              </form>
            </div>
          </div>
          <div className="lg:col-span-2">
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">ID</th>
                    <th className="px-6 py-3 font-medium">Nombre</th>
                    <th className="px-6 py-3 font-medium">Descripción</th>
                    <th className="px-6 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(data) && data.map(s => (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-500">{s.id}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{s.nombre}</td>
                        <td className="px-6 py-3 text-slate-500 truncate max-w-xs">{s.descripcion}</td>
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => setCandidateModal({ show: true, slateId: s.id })}
                            className="text-blue-600 hover:text-blue-800 font-bold text-sm transition-all hover:underline flex items-center gap-2 justify-end ml-auto"
                          >
                            <Users className="w-4 h-4" />
                            Gestionar Candidatos
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {(!data || !Array.isArray(data) || data.length === 0) && (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No hay planchas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {(Array.isArray(data) && data.length > 0) && (
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={deleteAllSlates}
                  className="group flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-200 transition-all duration-300 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
                  Borrar Todas las Planchas
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'voters') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Registrar Elector
              </h3>
              <form onSubmit={generateVoter} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Nombre</label>
                  <input name="nombre" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email</label>
                  <input name="email" type="email" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition">
                  Generar Token
                </button>
              </form>
            </div>

            <div className="mt-6 bg-blue-50 rounded-xl border border-blue-100 p-6">
              <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Carga Masiva (Excel)</h4>
              <div className="space-y-3">
                <button 
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 bg-white text-blue-600 border border-blue-200 py-3 rounded-xl font-bold text-xs hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Descargar Plantilla
                </button>
                
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={importVoters}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <button 
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
                  >
                    <Upload className="w-4 h-4" />
                    Subir Excel Diligenciado
                  </button>
                </div>
              </div>



              <p className="mt-4 text-[10px] text-blue-400 leading-tight">
                * Asegúrese de usar los encabezados: <b>Nombre</b> y <b>Email</b>.
              </p>
            </div>
          </div>
          <div className="lg:col-span-2">
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Nombre</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Token</th>
                      <th className="px-6 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(data) && data.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800">{v.nombre}</td>
                        <td className="px-6 py-3 text-slate-500">{v.email}</td>
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs select-all">
                          {v.token || 'Sin token'}
                        </td>
                        <td className="px-6 py-3">
                          {v.used ? (
                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium">Ya Votó</span>
                          ) : (
                            <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs font-medium">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!data || !Array.isArray(data) || data.length === 0) && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No hay electores registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {(Array.isArray(data) && data.length > 0) && (
              <div className="mt-6 flex justify-end gap-4">
                <button 
                  onClick={sendTokensByEmail}
                  className="group flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 active:scale-95"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Enviar Tokens por Email
                </button>

                <button 
                  onClick={resetVoting}
                  className="group flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 transition-transform group-hover:rotate-45" />
                  Reiniciar Votación
                </button>

                <button 
                  onClick={deleteAllVoters}
                  className="group flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-200 transition-all duration-300 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
                  Vaciar Censo Electoral
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (activeTab === 'settings') {
      if (!data || Array.isArray(data)) return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;
      
      return (
        <div className="max-w-2xl mx-auto animate-fade-in-up">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Configuración General
              </h3>
            </div>
            <form onSubmit={saveSettings} className="p-8 space-y-8">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center mb-4 group relative shadow-inner">
                  {data.logo_base64 ? (
                    <img src={data.logo_base64} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Plus className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Logo</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    name="logo" 
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-all flex items-center justify-center">
                    <div className="bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">Cambiar</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Logo Institucional</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Sindicato</label>
                  <input 
                    name="union_nombre" 
                    defaultValue={data.union_nombre}
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="Nombre oficial"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Elección</label>
                  <input 
                    name="eleccion_nombre" 
                    defaultValue={data.eleccion_nombre}
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="Ej. Junta Directiva 2024"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha del Evento</label>
                  <input 
                    type="date"
                    name="eleccion_fecha" 
                    defaultValue={data.eleccion_fecha}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email de Contacto</label>
                  <input 
                    type="email"
                    name="email" 
                    defaultValue={data.email}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="correo@entidad.com"
                  />
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button 
                  type="submit"
                  className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-900 hover:-translate-y-1 transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Configuración del Servidor de Correo (SMTP)
              </h3>
            </div>
            <form onSubmit={saveSettings} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Servidor SMTP (Host)</label>
                  <input 
                    name="smtp_host" 
                    defaultValue={data.smtp_host}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Puerto</label>
                  <input 
                    name="smtp_port" 
                    type="number"
                    defaultValue={data.smtp_port}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="465 o 587"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario / Email SMTP</label>
                  <input 
                    name="smtp_user" 
                    defaultValue={data.smtp_user}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="tu-correo@gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña SMTP</label>
                  <input 
                    name="smtp_pass" 
                    type="password"
                    defaultValue={data.smtp_pass}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="Contraseña de aplicación"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  name="smtp_secure" 
                  id="smtp_secure" 
                  defaultChecked={data.smtp_secure === 1}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="smtp_secure" className="text-sm font-bold text-slate-600">Usar SSL/TLS (Puerto 465)</label>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-900 hover:-translate-y-1 transition-all active:scale-95"
                >
                  Guardar Configuración SMTP
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Seguridad de la Cuenta
              </h3>
            </div>
            <form onSubmit={updatePassword} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña Actual</label>
                  <input 
                    type="password"
                    name="currentPassword" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                  <input 
                    type="password"
                    name="newPassword" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nueva</label>
                  <input 
                    type="password"
                    name="confirmPassword" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="Repita la contraseña"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-md">
              <h4 className="font-bold text-slate-700 mb-1">Mantenimiento y Seguridad</h4>
              <p className="text-sm text-slate-500">Gestione la integridad de sus datos. Realice copias periódicas o limpie el sistema para un nuevo proceso.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={downloadBackup}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95"
              >
                <Download className="w-5 h-5" />
                Copia de Seguridad
              </button>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".sqlite" 
                  onChange={handleRestoreFile}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  title="Cargar archivo .sqlite"
                />
                <button 
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-100 transition-all active:scale-95"
                >
                  <Upload className="w-5 h-5" />
                  Restaurar Datos
                </button>
              </div>
              
              <button 
                onClick={resetSystem}
                className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all active:scale-95"
              >
                <Trash2 className="w-5 h-5" />
                Resetear Sistema
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'positions') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nuevo Cargo
              </h3>
              <form onSubmit={createPosition} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Nombre del Cargo</label>
                  <input name="nombre" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Vocal" />
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition">
                  Guardar Cargo
                </button>
              </form>
            </div>
          </div>
          <div className="lg:col-span-2">
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nombre del Cargo</th>
                    <th className="px-6 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(data) && data.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        {editingPosition === p.id ? (
                          <form onSubmit={(e) => updatePosition(e, p.id)} className="flex gap-2">
                            <input name="nombre" defaultValue={p.nombre} required className="px-3 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none flex-1" />
                            <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold">OK</button>
                            <button type="button" onClick={() => setEditingPosition(null)} className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">X</button>
                          </form>
                        ) : (
                          <span className="font-medium text-slate-800">{p.nombre}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingPosition(p.id)} className="text-blue-600 hover:text-blue-800 font-bold text-sm">Editar</button>
                          <button onClick={() => deletePosition(p.id)} className="text-red-600 hover:text-red-800 font-bold text-sm">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data || !Array.isArray(data) || data.length === 0) && (
                    <tr><td colSpan="2" className="px-6 py-8 text-center text-slate-500">No hay cargos registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'documentation') {
      return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                <BookOpen className="w-8 h-8" />
                Guía del Administrador
              </h2>
              <p className="text-blue-100 font-medium max-w-2xl">Bienvenido a la documentación oficial de VotoSindical. Aquí encontrarás todo lo necesario para gestionar procesos electorales transparentes, seguros y eficientes.</p>
            </div>
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="flex flex-wrap gap-4 mt-6">
              <button 
                onClick={generateDataDictionaryPDF}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-white/20 backdrop-blur-md active:scale-95"
              >
                <Download className="w-4 h-4" />
                Diccionario de Datos (PDF)
              </button>
              
              <button 
                onClick={generateDirectoryStructurePDF}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-white/20 backdrop-blur-md active:scale-95"
              >
                <FolderTree className="w-4 h-4" />
                Estructura de Carpetas (PDF)
              </button>

              <button 
                onClick={generateAPIDocumentationPDF}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-white/20 backdrop-blur-md active:scale-95"
              >
                <Code className="w-4 h-4" />
                Documentación API (PDF)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Requisitos y Acceso */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">Requisitos y Acceso</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></div>
                    <p className="text-sm text-slate-600"><b>Credenciales por defecto:</b> Usuario: <code>admin</code> | Contraseña: <code>admin123</code></p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></div>
                    <p className="text-sm text-slate-600"><b>Servidor:</b> Requiere entorno Node.js v16+ y base de datos SQLite.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></div>
                    <p className="text-sm text-slate-600"><b>Conectividad:</b> Para envío de tokens vía email, configure un servidor SMTP válido en Ajustes.</p>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">Funcionalidades Core</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Resultados en Tiempo Real</h4>
                    <p className="text-xs text-slate-500">Visualice el conteo de votos, tasa de participación y abstención con gráficas dinámicas.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Gestión de Planchas</h4>
                    <p className="text-xs text-slate-500">Cree grupos electorales y asigne candidatos con fotos y cargos específicos.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Control del Censo</h4>
                    <p className="text-xs text-slate-500">Importe electores desde Excel masivamente o regístrelos uno a uno.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flujo de Trabajo */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-blue-400" />
                Flujo Recomendado
              </h3>
              
              <div className="space-y-8 relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800"></div>
                
                <div className="relative flex gap-6">
                  <div className="w-6 h-6 rounded-full bg-blue-600 border-4 border-slate-900 z-10"></div>
                  <div>
                    <h4 className="font-bold text-blue-400 text-sm uppercase tracking-widest mb-1">Paso 1: Configuración</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Defina el nombre del sindicato, el logo y la fecha de la elección en la pestaña de Ajustes.</p>
                  </div>
                </div>

                <div className="relative flex gap-6">
                  <div className="w-6 h-6 rounded-full bg-blue-600 border-4 border-slate-900 z-10"></div>
                  <div>
                    <h4 className="font-bold text-blue-400 text-sm uppercase tracking-widest mb-1">Paso 2: Definir Cargos</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Cree los cargos (Presidente, Tesorero, etc.) para que los candidatos puedan postularse correctamente.</p>
                  </div>
                </div>

                <div className="relative flex gap-6">
                  <div className="w-6 h-6 rounded-full bg-blue-600 border-4 border-slate-900 z-10"></div>
                  <div>
                    <h4 className="font-bold text-blue-400 text-sm uppercase tracking-widest mb-1">Paso 3: Armar Planchas</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Registre las planchas y sus integrantes. Asegúrese de subir fotos claras para los votantes.</p>
                  </div>
                </div>

                <div className="relative flex gap-6">
                  <div className="w-6 h-6 rounded-full bg-blue-600 border-4 border-slate-900 z-10"></div>
                  <div>
                    <h4 className="font-bold text-blue-400 text-sm uppercase tracking-widest mb-1">Paso 4: Censo Electoral</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Suba la lista de votantes. Use el botón "Enviar Tokens" para despachar los códigos secretos por email.</p>
                  </div>
                </div>

                <div className="relative flex gap-6">
                  <div className="w-6 h-6 rounded-full bg-green-500 border-4 border-slate-900 z-10"></div>
                  <div>
                    <h4 className="font-bold text-green-400 text-sm uppercase tracking-widest mb-1">Paso 5: Monitoreo</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Observe los resultados en vivo. Al finalizar, descargue el Reporte PDF Oficial como acta de cierre.</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Seguridad Crítica</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Recuerde realizar una <b>Copia de Seguridad</b> antes de cualquier cambio masivo. El botón "Resetear Sistema" borrará permanentemente toda la información para iniciar un nuevo proceso.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500 text-sm">Gestiona la elección y monitorea los resultados en tiempo real.</p>
      </header>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-8 inline-flex">
        <button 
          onClick={() => setActiveTab('results')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'results' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BarChart3 className="w-4 h-4" /> Resultados
        </button>
        <button 
          onClick={() => setActiveTab('slates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'slates' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" /> Planchas
        </button>
        <button 
          onClick={() => setActiveTab('voters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'voters' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="w-4 h-4" /> Electores / Tokens
        </button>
        <button 
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'positions' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShieldCheck className="w-4 h-4" /> Cargos
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Settings className="w-4 h-4" /> Configuración
        </button>
        <button 
          onClick={() => setActiveTab('documentation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'documentation' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BookOpen className="w-4 h-4" /> Documentación
        </button>
      </div>

      {renderContent()}

      {/* Modal de Gestión de Candidatos */}
      {candidateModal.show && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-900/40" 
            onClick={() => { setCandidateModal({ show: false, slateId: null }); setEditingCandidate(null); }}
          ></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden relative z-10 animate-zoom-in border border-white flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Gestionar Candidatos</h3>
                  <p className="text-sm text-slate-500 font-medium">Plancha: <span className="text-blue-600 font-bold">{currentSlate?.nombre}</span></p>
                </div>
              </div>
              <button 
                onClick={() => { setCandidateModal({ show: false, slateId: null }); setEditingCandidate(null); }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Formulario de Registro */}
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Registrar Integrante
                    </h4>
                    <form onSubmit={(e) => createCandidate(e, currentSlate?.id)} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                        <input name="nombre" required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700" placeholder="Ej: Juan Pérez" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Cargo a Postular</label>
                        <select name="cargo" required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 appearance-none">
                          <option value="">Seleccione un cargo...</option>
                          {cache.positions && cache.positions.map(p => (
                            <option key={p.id} value={p.nombre}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fotografía (Opcional)</label>
                        <input name="foto_file" type="file" accept="image/*" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer" />
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95">
                        Añadir a la Plancha
                      </button>
                    </form>
                  </div>
                </div>

                {/* Lista de Integrantes */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 ml-1">
                    Integrantes Actuales ({currentSlate?.candidates?.length || 0})
                  </h4>
                  <div className="space-y-3">
                    {(!currentSlate?.candidates || currentSlate.candidates.length === 0) ? (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <Users className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                        <p className="text-slate-400 font-medium">No hay integrantes registrados</p>
                      </div>
                    ) : (
                      currentSlate.candidates.map(c => (
                        <div key={c.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group">
                          {editingCandidate === c.id ? (
                            <form onSubmit={(e) => updateCandidate(e, c.id, c.foto_url)} className="w-full space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <input name="nombre" defaultValue={c.nombre} required className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-xs font-bold" />
                                <select name="cargo" defaultValue={c.cargo} required className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-xs font-bold appearance-none">
                                  {cache.positions && cache.positions.map(p => (
                                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <input name="foto_file" type="file" accept="image/*" className="text-[10px] flex-1" />
                                <div className="flex gap-2">
                                  <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold">Guardar</button>
                                  <button type="button" onClick={() => setEditingCandidate(null)} className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold">Cerrar</button>
                                </div>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-sm shrink-0">
                                  {c.foto_url ? (
                                    <img src={c.foto_url} alt={c.nombre} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-lg font-black text-slate-300">
                                      {c.nombre.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h5 className="font-bold text-slate-800 leading-none mb-1">{c.nombre}</h5>
                                  <p className="text-xs font-bold text-blue-600 uppercase tracking-tighter">{c.cargo}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingCandidate(c.id)} className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all">
                                  ✏️
                                </button>
                                <button onClick={() => deleteCandidate(c.id)} className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all">
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Personalizado */}
      {modalConfig.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-900/40" 
            onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
          ></div>
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden relative z-10 animate-zoom-in border border-white">
            <div className={`p-8 text-center ${modalConfig.type === 'danger' ? 'bg-red-50/50' : 'bg-blue-50/50'}`}>
              <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-6 ${modalConfig.type === 'danger' ? 'bg-red-100 text-red-600 shadow-inner' : 'bg-blue-100 text-blue-600 shadow-inner'}`}>
                {modalConfig.type === 'danger' ? <Trash2 className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">{modalConfig.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed px-2">{modalConfig.message}</p>
            </div>
            
            <div className="p-8 space-y-6">
              {modalConfig.requireInput && (
                <div className="animate-fade-in-up">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 text-center">Escribe "{modalConfig.confirmWord}" para confirmar</label>
                  <input 
                    type="text" 
                    value={modalConfig.inputValue}
                    onChange={(e) => setModalConfig(prev => ({ ...prev, inputValue: e.target.value.toUpperCase() }))}
                    className="w-full text-center py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-200"
                    placeholder="CONFIRMADO"
                    autoFocus
                  />
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={modalConfig.onConfirm}
                  disabled={modalConfig.requireInput && modalConfig.inputValue !== modalConfig.confirmWord}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale ${modalConfig.type === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200/50' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200/50'}`}
                >
                  Confirmar Acción
                </button>
                <button 
                  onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                  className="w-full py-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm uppercase tracking-widest"
                >
                  Cancelar Operación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
