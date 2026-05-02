const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.join(__dirname, '../.env') });
dotenvExpand.expand(myEnv);


const db = new Database(path.join(__dirname, 'database.sqlite'));

// Inicializar tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      union_nombre TEXT,
      eleccion_nombre TEXT,
      eleccion_fecha TEXT,
      email TEXT,
      logo_base64 TEXT,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_secure INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS slates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slate_id INTEGER,
      nombre TEXT,
      cargo TEXT,
      foto_url TEXT,
      FOREIGN KEY(slate_id) REFERENCES slates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      nombre TEXT,
      token TEXT UNIQUE,
      used INTEGER DEFAULT 0,
      timestamp_vote TEXT
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slate_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(slate_id) REFERENCES slates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_voters_email ON voters(email);
    CREATE INDEX IF NOT EXISTS idx_voters_token ON voters(token);
    CREATE INDEX IF NOT EXISTS idx_candidates_slate ON candidates(slate_id);
    CREATE INDEX IF NOT EXISTS idx_votes_slate ON votes(slate_id);
  `);

// Insertar cargos iniciales si la tabla está vacía
const positionCount = db.prepare('SELECT COUNT(*) as count FROM positions').get().count;
if (positionCount === 0) {
  const defaultPositions = [
    'Presidente',
    'Vicepresidente',
    'Secretaría General',
    'Tesorero',
    'Secretaría Juridica',
    'Secretaría de Derechos Humanos',
    'Secretaría de Comunicaciones',
    'Secretaría de Educación',
    'Secretaría de Tecnología'
  ];
  const insertPosition = db.prepare('INSERT INTO positions (nombre) VALUES (?)');
  db.transaction(() => {
    for (const pos of defaultPositions) {
      insertPosition.run(pos);
    }
  })();
  console.log('Cargos iniciales insertados.');
}

// Migración para añadir columnas SMTP si no existen
const tableInfo = db.prepare("PRAGMA table_info(settings)").all();
const columns = tableInfo.map(col => col.name);

if (!columns.includes('smtp_host')) {
  db.exec(`
    ALTER TABLE settings ADD COLUMN smtp_host TEXT;
    ALTER TABLE settings ADD COLUMN smtp_port INTEGER;
    ALTER TABLE settings ADD COLUMN smtp_user TEXT;
    ALTER TABLE settings ADD COLUMN smtp_pass TEXT;
    ALTER TABLE settings ADD COLUMN smtp_secure INTEGER DEFAULT 1;
  `);
}

const votersTableInfo = db.prepare("PRAGMA table_info(voters)").all();
const voterColumns = votersTableInfo.map(c => c.name);
if (!voterColumns.includes('timestamp_vote')) {
  db.exec('ALTER TABLE voters ADD COLUMN timestamp_vote TEXT');
}

// Insertar admin inicial si la tabla está vacía
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
if (adminCount === 0) {
  const defaultUser = process.env.ADMIN_USERNAME || 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPass = bcrypt.hashSync(defaultPass, 10);
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(defaultUser, hashedPass);
  console.log(`Usuario administrador inicial migrado desde .env: ${defaultUser}`);
}
  
console.log('Tablas de la base de datos inicializadas.');

module.exports = db;
