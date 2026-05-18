const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.join(__dirname, '../.env') });
dotenvExpand.expand(myEnv);

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let t = '';
  for (let i = 0; i < 8; i++) {
    t += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${t.substring(0, 4)}-${t.substring(4, 8)}`;
};
const fs = require('fs');
const multer = require('multer');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const compression = require('compression');
const db = require('./db');

const upload = multer({ dest: 'uploads/' });

const app = express();
const port = process.env.BACKEND_PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Asegurar que existe carpeta uploads
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- Middleware de Autenticación de Administrador ---
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not an admin');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const generateEmailTemplate = (settings, voter, isTest = false) => {
  const attachments = [];
  let logoHtml = '';

  if (settings.logo_base64) {
    attachments.push({
      filename: 'logo.png',
      path: settings.logo_base64,
      cid: 'logo_sindicato'
    });
    logoHtml = `<div style="text-align: center; margin-bottom: 20px;"><img src="cid:logo_sindicato" alt="Logo Sindicato" style="max-height: 80px; border-radius: 8px;" /></div>`;
  }

  const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const horaActual = new Date().toLocaleTimeString('es-CO');
  const trazabilidadId = isTest ? 'TEST-0000-0000' : uuidv4().split('-')[0].toUpperCase();

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #f8fafc; padding: 30px 40px; border-bottom: 1px solid #e2e8f0;">
        ${logoHtml}
        <h2 style="color: #1e293b; text-align: center; margin: 0; font-size: 24px; font-weight: 800;">${settings.eleccion_nombre || 'Elecciones Sindicales'}</h2>
        <p style="color: #64748b; text-align: center; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${settings.union_nombre || ''}</p>
      </div>
      
      <div style="padding: 40px;">
        <h3 style="color: #334155; font-size: 18px; margin-top: 0;">Estimado/a ${voter.nombre},</h3>
        
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Te extendemos una cordial invitación para ejercer tu derecho al voto en la presente jornada electoral. Tu participación es fundamental para fortalecer la democracia dentro de nuestra organización y elegir a nuestros representantes.
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
          <p style="color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Tu Código Único y Secreto de Votación</p>
          <div style="font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #15803d; font-family: monospace;">
            ${voter.token}
          </div>
          <p style="color: #166534; font-size: 12px; margin: 15px 0 0 0; opacity: 0.8;">⚠️ Este código es personal, intransferible y de un solo uso.</p>
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="https://votaciones.itasesorias.com/v/${voter.token}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
            Ir al Sistema de Votación
          </a>
        </div>

        <div style="border-top: 2px dashed #e2e8f0; margin-top: 40px; padding-top: 30px;">
          <h4 style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Trazabilidad y Seguridad del Mensaje</h4>
          <table style="width: 100%; font-size: 12px; color: #94a3b8; border-collapse: collapse;">
            <tr><td style="padding: 4px 0;"><strong>ID de Envío:</strong></td><td style="text-align: right; font-family: monospace;">MSG-${trazabilidadId}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Fecha de Generación:</strong></td><td style="text-align: right;">${fechaActual}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Hora de Generación:</strong></td><td style="text-align: right;">${horaActual}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Plataforma:</strong></td><td style="text-align: right;">VotoSindical Secure System</td></tr>
          </table>
        </div>
      </div>
      
      <div style="background-color: #1e293b; padding: 20px; text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.5;">
        Este es un correo automático generado por el sistema oficial de votación electrónica. Por favor no responda a esta dirección.<br/>
        <span style="color: #64748b; margin-top: 10px; display: block;">Si usted no hace parte de la organización sindical, por favor haga caso omiso de este mensaje o reporte la posible falla en la remisión contactando al administrador en: <strong>${settings.email}</strong></span>
      </div>
    </div>
  `;

  const text = `
    ${settings.eleccion_nombre || 'Elecciones Sindicales'}
    ${settings.union_nombre || ''}
    
    Estimado/a ${voter.nombre},
    
    Te extendemos una cordial invitación para ejercer tu derecho al voto en la presente jornada electoral. Tu participación es fundamental para fortalecer la democracia dentro de nuestra organización y elegir a nuestros representantes.
    
    Tu Código Único y Secreto de Votación:
    ${voter.token}
    (Este código es personal, intransferible y de un solo uso.)
    
    Enlace de votación:
    https://votaciones.itasesorias.com/v/${voter.token}
    
    Trazabilidad y Seguridad del Mensaje:
    ID de Envío: MSG-${trazabilidadId}
    Fecha: ${fechaActual}
    Hora: ${horaActual}
    
    Este es un correo automático. Si usted no hace parte de la organización sindical, por favor haga caso omiso de este mensaje o reporte la posible falla en la remisión contactando al administrador en: ${settings.email}
  `.replace(/^ +/gm, '').trim();

  return { html, text, attachments };
};

// Obtener configuración pública
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

// --- Rutas Públicas (Electores) ---

// Validar token de votante
app.post('/api/auth/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token es requerido' });

  const voter = db.prepare('SELECT * FROM voters WHERE token = ?').get(token);
  if (!voter) return res.status(404).json({ error: 'Token inválido' });
  if (voter.used) return res.status(403).json({ error: 'Este token ya fue utilizado' });

  res.json({ success: true, voter: { nombre: voter.nombre, email: voter.email } });
});

// Obtener planchas y candidatos
app.get('/api/slates', (req, res) => {
  const slates = db.prepare('SELECT * FROM slates').all();
  const candidates = db.prepare('SELECT * FROM candidates').all();

  const slatesWithCandidates = slates.map(slate => ({
    ...slate,
    candidates: candidates.filter(c => c.slate_id === slate.id)
  }));

  res.json(slatesWithCandidates);
});

app.get('/api/results', (req, res) => {
  const slates = db.prepare(`
    SELECT s.id, s.nombre, COUNT(v.id) as votos
    FROM slates s
    LEFT JOIN votes v ON s.id = v.slate_id
    GROUP BY s.id
  `).all();
  
  const candidates = db.prepare('SELECT * FROM candidates').all();
  
  const results = slates.map(slate => ({
    ...slate,
    candidates: candidates.filter(c => c.slate_id === slate.id)
  }));
  
  const totalElectors = db.prepare('SELECT COUNT(*) as total FROM voters').get().total;
  const totalVotes = db.prepare('SELECT COUNT(*) as total FROM votes').get().total;

  res.json({ results, totalVotes, totalElectors });
});

// Registrar voto (Usa transacción para evitar doble voto)
app.post('/api/vote', (req, res) => {
  const { token, slate_id } = req.body;
  if (!token || !slate_id) return res.status(400).json({ error: 'Token y slate_id requeridos' });

  try {
    const registerVote = db.transaction(() => {
      const voter = db.prepare('SELECT * FROM voters WHERE token = ?').get(token);
      if (!voter) throw new Error('Token inválido');
      if (voter.used) throw new Error('Token ya utilizado');

      const slate = db.prepare('SELECT id FROM slates WHERE id = ?').get(slate_id);
      if (!slate) throw new Error('Plancha inválida');

      // Marcar token como usado
      db.prepare('UPDATE voters SET used = 1, timestamp_vote = CURRENT_TIMESTAMP WHERE id = ?').run(voter.id);
      
      // Registrar voto anónimo
      db.prepare('INSERT INTO votes (slate_id) VALUES (?)').run(slate_id);
    });

    registerVote();
    res.json({ success: true, message: 'Voto registrado exitosamente' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Rutas de Administración ---

// Login Admin
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (admin && bcrypt.compareSync(password, admin.password)) {
    const token = jwt.sign({ role: 'admin', id: admin.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// Obtener Resultados
app.get('/api/admin/results', authenticateAdmin, (req, res) => {
  const results = db.prepare(`
    SELECT s.id, s.nombre, COUNT(v.id) as votos
    FROM slates s
    LEFT JOIN votes v ON s.id = v.slate_id
    GROUP BY s.id
  `).all();
  
  const totalVotes = db.prepare('SELECT COUNT(*) as total FROM votes').get().total;

  res.json({ results, totalVotes });
});

// CRUD Planchas
app.get('/api/admin/slates', authenticateAdmin, (req, res) => {
  const slates = db.prepare('SELECT * FROM slates').all();
  const candidates = db.prepare('SELECT * FROM candidates').all();
  
  const slatesWithCandidates = slates.map(slate => ({
    ...slate,
    candidates: candidates.filter(c => c.slate_id === slate.id)
  }));
  
  res.json(slatesWithCandidates);
});

app.post('/api/admin/slates', authenticateAdmin, (req, res) => {
  const { nombre, descripcion } = req.body;
  const info = db.prepare('INSERT INTO slates (nombre, descripcion) VALUES (?, ?)').run(nombre, descripcion);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/slates/:id', authenticateAdmin, (req, res) => {
  db.prepare('DELETE FROM slates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// CRUD Candidatos
app.get('/api/admin/candidates', authenticateAdmin, (req, res) => {
  const candidates = db.prepare('SELECT * FROM candidates').all();
  res.json(candidates);
});

app.post('/api/admin/candidates', authenticateAdmin, (req, res) => {
  const { slate_id, nombre, cargo, foto_url } = req.body;
  const info = db.prepare('INSERT INTO candidates (slate_id, nombre, cargo, foto_url) VALUES (?, ?, ?, ?)').run(slate_id, nombre, cargo, foto_url);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/admin/candidates/:id', authenticateAdmin, (req, res) => {
  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/candidates/:id', authenticateAdmin, (req, res) => {
  const { nombre, cargo, foto_url } = req.body;
  try {
    db.prepare('UPDATE candidates SET nombre = ?, cargo = ?, foto_url = ? WHERE id = ?').run(nombre, cargo, foto_url, req.params.id);
    res.json({ success: true });
  } catch(err) {
    res.status(400).json({ error: err.message });
  }
});

// CRUD Cargos (Positions)
app.get('/api/admin/positions', authenticateAdmin, (req, res) => {
  const positions = db.prepare('SELECT * FROM positions ORDER BY nombre').all();
  res.json(positions);
});

app.post('/api/admin/positions', authenticateAdmin, (req, res) => {
  const { nombre } = req.body;
  try {
    const info = db.prepare('INSERT INTO positions (nombre) VALUES (?)').run(nombre);
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/positions/:id', authenticateAdmin, (req, res) => {
  const { nombre } = req.body;
  try {
    db.prepare('UPDATE positions SET nombre = ? WHERE id = ?').run(nombre, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/positions/:id', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CRUD Electores y Tokens
app.get('/api/admin/voters', authenticateAdmin, (req, res) => {
  const voters = db.prepare('SELECT id, email, nombre, token, used, timestamp_vote FROM voters').all();
  res.json(voters);
});

app.post('/api/admin/voters', authenticateAdmin, (req, res) => {
  const { email, nombre } = req.body;
  const token = generateToken();
  try {
    const info = db.prepare('INSERT INTO voters (email, nombre, token) VALUES (?, ?, ?)').run(email, nombre, token);
    res.json({ id: info.lastInsertRowid, token });
  } catch(err) {
    res.status(400).json({ error: err.message });
  }
});

// Plantilla Excel de Electores
app.get('/api/admin/voters/template', authenticateAdmin, (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    const ws_data = [
      ["Nombre", "Email"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Electores");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_electores.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importar Electores desde Excel
app.post('/api/admin/voters/import', authenticateAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const insert = db.prepare('INSERT INTO voters (nombre, email, token) VALUES (?, ?, ?)');
    const importTransaction = db.transaction((voters) => {
      for (const v of voters) {
        const nombre = v.Nombre || v.nombre || '';
        const email = v.Email || v.email || '';
        if (!email) continue;
        const existing = db.prepare('SELECT id FROM voters WHERE email = ?').get(email);
        if (existing) continue;
        insert.run(nombre.toString(), email.toString(), generateToken());
      }
    });
    importTransaction(data);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, count: data.length });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// Borrar todos los electores
app.delete('/api/admin/voters', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM voters').run();
    db.prepare('DELETE FROM votes').run(); // Al borrar electores, los votos quedan inválidos
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un elector
app.put('/api/admin/voters/:id', authenticateAdmin, (req, res) => {
  const { nombre, email } = req.body;
  try {
    db.prepare('UPDATE voters SET nombre = ?, email = ? WHERE id = ?').run(nombre, email, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar un elector
app.delete('/api/admin/voters/:id', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM voters WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar todas las planchas
app.delete('/api/admin/slates', authenticateAdmin, (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM candidates').run();
      db.prepare('DELETE FROM slates').run();
      db.prepare('DELETE FROM votes').run(); // Votos dependen de las planchas
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reiniciar votación globalmente
app.post('/api/admin/votes/reset', authenticateAdmin, (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM votes').run();
      db.prepare('UPDATE voters SET used = 0, timestamp_vote = NULL').run();
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/backup', authenticateAdmin, (req, res) => {
  const dbPath = path.join(__dirname, 'database.sqlite');
  res.download(dbPath, `respaldo_votacion_${new Date().toISOString().split('T')[0]}.sqlite`);
});

app.post('/api/admin/reset', authenticateAdmin, (req, res) => {
  try {
    const reset = db.transaction(() => {
      db.prepare('DELETE FROM votes').run();
      db.prepare('DELETE FROM candidates').run();
      db.prepare('DELETE FROM slates').run();
      db.prepare('DELETE FROM voters').run();
      db.prepare('DELETE FROM positions').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('votes', 'candidates', 'slates', 'voters', 'positions')").run();
      
      // Resetear configuración a valores por defecto
      db.prepare(`
        UPDATE settings 
        SET union_nombre = ?, eleccion_nombre = ?, eleccion_fecha = ?, email = ?, logo_base64 = ?,
            smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_secure = ?, smtp_delay = ?
        WHERE id = 1
      `).run("Sindicato Ejemplo", "Elecciones 2024", "", "", "", "", null, "", "", 1, 1);
    });
    reset();
    res.json({ success: true, message: 'Sistema reseteado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/restore', authenticateAdmin, upload.single('database'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  const tempPath = req.file.path;
  const dbPath = path.join(__dirname, 'database.sqlite');

  try {
    // Para restaurar, abrimos el archivo subido y hacemos backup HACIA el archivo principal
    // SQLite permite hacer backup sobre una base de datos abierta.
    const sourceDb = new Database(tempPath);
    await sourceDb.backup(dbPath);
    sourceDb.close();
    
    // Limpiar
    fs.unlinkSync(tempPath);
    
    res.json({ success: true, message: 'Base de datos restaurada correctamente' });
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error(err);
    res.status(500).json({ error: 'Error al restaurar: ' + err.message });
  }
});

app.post('/api/admin/settings', authenticateAdmin, (req, res) => {
  const { 
    union_nombre, eleccion_nombre, eleccion_fecha, email, logo_base64,
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_delay
  } = req.body;
  try {
    db.prepare(`
      UPDATE settings 
      SET union_nombre = ?, eleccion_nombre = ?, eleccion_fecha = ?, email = ?, logo_base64 = ?,
          smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_secure = ?, smtp_delay = ?
      WHERE id = 1
    `).run(
      union_nombre, eleccion_nombre, eleccion_fecha, email, logo_base64,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure ? 1 : 0, smtp_delay !== undefined ? smtp_delay : 1
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Probar configuración SMTP
app.post('/api/admin/settings/test-smtp', authenticateAdmin, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, test_email } = req.body;

  if (!smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'Faltan datos de configuración SMTP para probar' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port ? parseInt(smtp_port) : 587,
      secure: smtp_secure === 1 || smtp_secure === true || smtp_secure === 'true',
      auth: {
        user: smtp_user,
        pass: smtp_pass
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Prueba VotoSindical" <${smtp_user}>`,
      to: test_email || smtp_user,
      subject: 'Prueba de Configuración SMTP Exitosa - VotoSindical',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 15px; text-align: center;">
          <h2 style="color: #2563eb;">¡Conexión Exitosa!</h2>
          <p>La configuración SMTP ingresada en VotoSindical es correcta y puede enviar correos.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'Correo de prueba enviado exitosamente a ' + (test_email || smtp_user) });
  } catch (err) {
    console.error('SMTP Test Error:', err);
    res.status(500).json({ error: 'Error de conexión SMTP: ' + err.message });
  }
});

// Enviar correo de prueba con la plantilla
app.post('/api/admin/settings/test-email-template', authenticateAdmin, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, test_email, union_nombre, eleccion_nombre, logo_base64, email } = req.body;

  if (!smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'Faltan datos de configuración SMTP para probar' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port ? parseInt(smtp_port) : 587,
      secure: smtp_secure === 1 || smtp_secure === true || smtp_secure === 'true',
      auth: {
        user: smtp_user,
        pass: smtp_pass
      }
    });

    await transporter.verify();

    const dummyVoter = {
      nombre: 'Elector de Prueba',
      token: 'ABC1-XYZ9'
    };
    
    const settings = {
      union_nombre,
      eleccion_nombre,
      logo_base64,
      email
    };

    const { html, text, attachments } = generateEmailTemplate(settings, dummyVoter, true);

    await transporter.sendMail({
      from: `"${union_nombre || 'Sindicato'}" <${email || smtp_user}>`,
      to: test_email || smtp_user,
      subject: `Elecciones UDEMERITOS 2026 – acceso seguro`,
      html,
      text,
      attachments,
      headers: {
        'List-Unsubscribe': `<mailto:${email || smtp_user}?subject=unsubscribe>`
      }
    });

    res.json({ success: true, message: 'Plantilla de prueba enviada exitosamente a ' + (test_email || smtp_user) });
  } catch (err) {
    console.error('Email Template Test Error:', err);
    res.status(500).json({ error: 'Error al enviar la plantilla: ' + err.message });
  }
});

// Actualizar contraseña admin
app.put('/api/admin/password', authenticateAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.user.id);
    if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hashedPass = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPass, req.user.id);
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar tokens por email
app.post('/api/admin/voters/send-emails', authenticateAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      res.write(JSON.stringify({ type: 'error', error: 'Configuración SMTP incompleta' }) + '\n');
      return res.end();
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure === 1,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass
      }
    });

    const voters = db.prepare('SELECT * FROM voters WHERE used = 0').all();
    let sentCount = 0;
    let failCount = 0;
    const totalCount = voters.length;

    res.write(JSON.stringify({ type: 'start', totalCount }) + '\n');

    const delayMs = (settings.smtp_delay !== undefined && settings.smtp_delay !== null ? settings.smtp_delay : 1) * 1000;

    for (const voter of voters) {
      try {
        const { html, text, attachments } = generateEmailTemplate(settings, voter, false);
        await transporter.sendMail({
          from: `"${settings.union_nombre}" <${settings.email}>`,
          to: voter.email,
          subject: `Elecciones UDEMERITOS 2026 – acceso seguro`,
          html,
          text,
          attachments,
          headers: {
            'List-Unsubscribe': `<mailto:${settings.email}?subject=unsubscribe>`
          }
        });
        sentCount++;
        res.write(JSON.stringify({ type: 'progress', sentCount, failCount, email: voter.email }) + '\n');
        if (delayMs > 0) await sleep(delayMs);
      } catch (err) {
        console.error(`Error enviando a ${voter.email}:`, err);
        failCount++;
        res.write(JSON.stringify({ type: 'progress', sentCount, failCount, email: voter.email, error: err.message }) + '\n');
      }
    }

    res.write(JSON.stringify({ type: 'done', sentCount, failCount }) + '\n');
    res.end();
  } catch (err) {
    res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Backend API Server corriendo en http://localhost:${port}`);
});
