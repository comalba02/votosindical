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
  const token = uuidv4();
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
        insert.run(nombre.toString(), email.toString(), uuidv4());
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
      // Resetear configuración a valores por defecto
      db.prepare(`
        UPDATE settings 
        SET union_nombre = ?, eleccion_nombre = ?, eleccion_fecha = ?, email = ?, logo_base64 = ?,
            smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_secure = ?
        WHERE id = 1
      `).run("Sindicato Ejemplo", "Elecciones 2024", "", "", "", "", null, "", "", 1);
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
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure
  } = req.body;
  try {
    db.prepare(`
      UPDATE settings 
      SET union_nombre = ?, eleccion_nombre = ?, eleccion_fecha = ?, email = ?, logo_base64 = ?,
          smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_secure = ?
      WHERE id = 1
    `).run(
      union_nombre, eleccion_nombre, eleccion_fecha, email, logo_base64,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure ? 1 : 0
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return res.status(400).json({ error: 'Configuración SMTP incompleta' });
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

    for (const voter of voters) {
      try {
        await transporter.sendMail({
          from: `"${settings.union_nombre}" <${settings.email}>`,
          to: voter.email,
          subject: `Tu Token de Votación - ${settings.eleccion_nombre}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
              <h2 style="color: #2563eb;">Hola, ${voter.nombre}</h2>
              <p>Has sido habilitado para participar en la jornada electoral: <strong>${settings.eleccion_nombre}</strong>.</p>
              <p>Para votar, ingresa al siguiente enlace:</p>
              <p style="text-align: center; margin: 20px 0;">
                <a href="https://votaciones.itasesorias.com/" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acceder al Sistema de Votación</a>
              </p>
              <p>Tu código personal y secreto de votación es:</p>
              <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; border-radius: 15px; margin: 30px 0;">
                ${voter.token}
              </div>
              <p style="color: #64748b; font-size: 14px;">Importante: Este código es de uso único y secreto. No lo compartas con nadie.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="font-size: 12px; color: #94a3b8;">${settings.union_nombre} - Sistema de Voto Electrónico</p>
            </div>
          `
        });
        sentCount++;
      } catch (err) {
        console.error(`Error enviando a ${voter.email}:`, err);
        failCount++;
      }
    }

    res.json({ success: true, sentCount, failCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API Server corriendo en http://localhost:${port}`);
});
