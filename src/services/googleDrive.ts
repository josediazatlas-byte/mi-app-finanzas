// ── Google Drive & Sheets service (browser REST API + GIS OAuth2) ──────────
// Note: googleapis npm package is Node.js-only. Browser SPAs use GIS + fetch.

const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS_API  = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES      = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/spreadsheets';
const BACKUP_FILENAME = 'mi-app-finanzas-backup.json';
const MAX_BACKUPS = 10;

// ── GIS types ──────────────────────────────────────────────────────────────
interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
}

interface GisTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (r: GisTokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): GisTokenClient;
          revoke(token: string, done: () => void): void;
        };
      };
    };
  }
}

// ── In-memory token (not persisted for security) ──────────────────────────
let _token: string | null = null;
let _tokenExpiry = 0;
let _tokenClient: GisTokenClient | null = null;
let _pendingResolve: ((t: string) => void) | null = null;
let _pendingReject: ((e: Error) => void) | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initGoogleAuth(clientId: string): Promise<void> {
  if (_tokenClient) return; // already inited
  await loadScript('https://accounts.google.com/gsi/client');
  _tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (r) => {
      if (r.error || !r.access_token) {
        _pendingReject?.(new Error(r.error ?? 'Token request failed'));
      } else {
        _token = r.access_token;
        _tokenExpiry = Date.now() + (r.expires_in - 60) * 1000;
        _pendingResolve?.(r.access_token);
      }
      _pendingResolve = null;
      _pendingReject = null;
    },
    error_callback: (e) => {
      _pendingReject?.(new Error(e.type));
      _pendingResolve = null;
      _pendingReject = null;
    },
  });
}

export function getToken(): string | null {
  return _token && Date.now() < _tokenExpiry ? _token : null;
}

export function requestToken(prompt?: 'select_account' | 'consent'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) { reject(new Error('Google Auth not initialized')); return; }
    const cached = getToken();
    if (cached) { resolve(cached); return; }
    _pendingResolve = resolve;
    _pendingReject = reject;
    _tokenClient.requestAccessToken(prompt ? { prompt } : {});
  });
}

export function revokeToken(): Promise<void> {
  return new Promise((resolve) => {
    if (_token && window.google?.accounts.oauth2.revoke) {
      window.google.accounts.oauth2.revoke(_token, () => { _token = null; _tokenExpiry = 0; resolve(); });
    } else {
      _token = null; _tokenExpiry = 0; resolve();
    }
  });
}

// ── Drive helpers ──────────────────────────────────────────────────────────
async function driveGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('No access token');
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive ${r.status}: ${await r.text()}`);
  return r.json();
}

async function driveDelete(fileId: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('No access token');
  await fetch(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

// ── Backup entry ───────────────────────────────────────────────────────────
export interface BackupEntry {
  id: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string; // ISO string
}

// ── List backups in appDataFolder ─────────────────────────────────────────
export async function listBackups(): Promise<BackupEntry[]> {
  const data = await driveGet<{ files: { id: string; name: string; size: string; modifiedTime: string }[] }>(
    '/files',
    { spaces: 'appDataFolder', fields: 'files(id,name,size,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '20' },
  );
  return (data.files ?? [])
    .filter(f => f.name === BACKUP_FILENAME)
    .map(f => ({ id: f.id, name: f.name, sizeBytes: parseInt(f.size ?? '0', 10), modifiedAt: f.modifiedTime }));
}

// ── Upload backup ──────────────────────────────────────────────────────────
export async function uploadBackup(payload: object): Promise<BackupEntry> {
  const token = getToken();
  if (!token) throw new Error('No access token');

  const content = JSON.stringify(payload, null, 2);
  const metadata = JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] });
  const boundary = 'backup_boundary_42';
  const body = [
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}`,
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}`,
    `\r\n--${boundary}--`,
  ].join('');

  const r = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,modifiedTime`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  const f = await r.json() as { id: string; name: string; size: string; modifiedTime: string };
  return { id: f.id, name: f.name, sizeBytes: parseInt(f.size ?? '0', 10), modifiedAt: f.modifiedTime };
}

// ── Download backup content ────────────────────────────────────────────────
export async function downloadBackup(fileId: string): Promise<Record<string, unknown>> {
  const token = getToken();
  if (!token) throw new Error('No access token');
  const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  return r.json();
}

// ── Create full backup + prune old ones ───────────────────────────────────
export async function createBackup(): Promise<BackupEntry> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) {
      try { data[k] = JSON.parse(localStorage.getItem(k) ?? 'null'); }
      catch { data[k] = localStorage.getItem(k); }
    }
  }
  const entry = await uploadBackup({ __backup: true, __version: 1, __ts: Date.now(), data });

  // Prune old backups (keep MAX_BACKUPS)
  const all = await listBackups();
  if (all.length > MAX_BACKUPS) {
    const toDelete = all.slice(MAX_BACKUPS);
    await Promise.allSettled(toDelete.map(f => driveDelete(f.id)));
  }
  return entry;
}

// ── Restore backup into localStorage ──────────────────────────────────────
export async function restoreBackup(fileId: string): Promise<void> {
  const raw = await downloadBackup(fileId);
  const data = (raw.data ?? raw) as Record<string, unknown>;
  Object.entries(data).forEach(([k, v]) => {
    if (k.startsWith('__')) return;
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  });
}

// ── Change hash (to detect if backup needed) ──────────────────────────────
const WATCHED_KEYS = [
  'finanzas-store', 'inversiones-store', 'inmueble-store', 'deuda-store',
  'facturas-store', 'suscripciones-store', 'metas-store', 'historico-store',
  'config-store', 'fondo-emergencia-store',
];

export function computeLocalHash(): string {
  let h = 5381;
  for (const k of WATCHED_KEYS) {
    const v = localStorage.getItem(k) ?? '';
    for (let i = 0; i < v.length; i++) h = (((h << 5) + h) ^ v.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

// ── Check if local data is empty (new device) ─────────────────────────────
export function isLocalDataEmpty(): boolean {
  const k = localStorage.getItem('finanzas-store');
  if (!k) return true;
  try {
    const s = JSON.parse(k);
    const state = s?.state ?? s;
    const ingresos = state?.ingresos?.length ?? 0;
    const gastos   = state?.gastos?.length ?? 0;
    const cuentas  = state?.cuentas?.length ?? 0;
    return ingresos + gastos + cuentas === 0;
  } catch { return true; }
}

// ── Google Sheets export ───────────────────────────────────────────────────
type SheetRow = (string | number)[];

interface SheetDef {
  title: string;
  headers: string[];
  rows: SheetRow[];
}

function rowData(row: SheetRow) {
  return {
    values: row.map(v => ({
      userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: String(v ?? '') },
    })),
  };
}

function sheetObject(def: SheetDef, index: number) {
  return {
    properties: { sheetId: index, title: def.title, index },
    data: [{
      startRow: 0, startColumn: 0,
      rowData: [
        // Header row (bold)
        {
          values: def.headers.map(h => ({
            userEnteredValue: { stringValue: h },
            userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.13, green: 0.13, blue: 0.16 } },
          })),
        },
        ...def.rows.map(rowData),
      ],
    }],
  };
}

export interface SheetsExportData {
  // Resumen
  patrimonio: { activos: number; pasivos: number; neto: number };
  cuentas: { nombre: string; tipo: string; saldo: number; divisa: string }[];
  inversiones: { simbolo: string; valor: number; pnl: number }[];
  inmuebles: { nombre: string; valorActual: number }[];
  deudas: { nombre: string; saldo: number }[];

  // Movimientos año
  movimientos: { fecha: string; tipo: string; categoria: string; descripcion: string; importe: number }[];

  // Cartera inversiones
  posiciones: {
    simbolo: string; nombre: string; tipo: string; acciones: number;
    precioMedio: number; precioActual: number; valor: number; pnl: number; pnlPct: number;
  }[];

  // Inmuebles
  inmueblesFull: {
    nombre: string; tipo: string; superficie: number; precioCompra: number;
    valorActual: number; plusvalia: number; yieldBruto: number;
  }[];

  // Facturas
  facturas: {
    numero: string; fecha: string; cliente: string; concepto: string;
    base: number; ivaPct: number; ivaImporte: number; total: number; estado: string;
  }[];

  // Histórico patrimonio
  historico: { mes: string; activos: number; pasivos: number; patrimonio: number }[];
}

export async function exportToSheets(exportData: SheetsExportData): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('No access token');

  const today = new Date().toLocaleDateString('es-ES');

  const sheets: SheetDef[] = [
    {
      title: 'Resumen patrimonio',
      headers: ['Categoría', 'Valor (€)'],
      rows: [
        ['Total activos', exportData.patrimonio.activos],
        ['Total pasivos', exportData.patrimonio.pasivos],
        ['Patrimonio neto', exportData.patrimonio.neto],
        ['', ''],
        ['— Cuentas —', ''],
        ...exportData.cuentas.map(c => [`${c.nombre} (${c.tipo})`, c.saldo]),
        ['', ''],
        ['— Inversiones (valor) —', ''],
        ...exportData.inversiones.map(i => [i.simbolo, i.valor]),
        ['', ''],
        ['— Inmuebles (valor) —', ''],
        ...exportData.inmuebles.map(i => [i.nombre, i.valorActual]),
        ['', ''],
        ['— Deudas —', ''],
        ...exportData.deudas.map(d => [d.nombre, -d.saldo]),
      ],
    },
    {
      title: 'Movimientos del año',
      headers: ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Importe (€)'],
      rows: exportData.movimientos.map(m => [m.fecha, m.tipo, m.categoria, m.descripcion, m.importe]),
    },
    {
      title: 'Cartera inversiones',
      headers: ['Símbolo', 'Nombre', 'Tipo', 'Acciones', 'Precio medio', 'Precio actual', 'Valor (€)', 'PnL (€)', 'PnL (%)'],
      rows: exportData.posiciones.map(p => [
        p.simbolo, p.nombre, p.tipo, p.acciones,
        p.precioMedio, p.precioActual, p.valor, p.pnl, p.pnlPct,
      ]),
    },
    {
      title: 'Inmuebles',
      headers: ['Nombre', 'Tipo', 'Superficie (m²)', 'Precio compra (€)', 'Valor actual (€)', 'Plusvalía (€)', 'Yield bruto (%)'],
      rows: exportData.inmueblesFull.map(i => [
        i.nombre, i.tipo, i.superficie, i.precioCompra, i.valorActual, i.plusvalia, i.yieldBruto,
      ]),
    },
    {
      title: 'Facturas emitidas',
      headers: ['Número', 'Fecha', 'Cliente', 'Concepto', 'Base (€)', 'IVA (%)', 'IVA (€)', 'Total (€)', 'Estado'],
      rows: exportData.facturas.map(f => [
        f.numero, f.fecha, f.cliente, f.concepto, f.base, f.ivaPct, f.ivaImporte, f.total, f.estado,
      ]),
    },
    {
      title: 'Histórico patrimonio mensual',
      headers: ['Mes', 'Activos (€)', 'Pasivos (€)', 'Patrimonio neto (€)'],
      rows: exportData.historico.map(h => [h.mes, h.activos, h.pasivos, h.patrimonio]),
    },
  ];

  const body = {
    properties: { title: `Mi App Financiera — Exportación ${today}`, locale: 'es_ES' },
    sheets: sheets.map((s, i) => sheetObject(s, i)),
  };

  const r = await fetch(SHEETS_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Sheets create failed: ${r.status}`);
  const result = await r.json() as { spreadsheetUrl: string };
  return result.spreadsheetUrl;
}
