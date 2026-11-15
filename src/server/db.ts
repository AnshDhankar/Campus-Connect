import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Student, Department, Staff, HelpComplaintRequest, Notification, Announcement, SubDepartment } from '../types';

const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.FUNCTION_TARGET
);

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATHS = {
  students: path.join(DATA_DIR, 'students.json'),
  departments: path.join(DATA_DIR, 'departments.json'),
  subdepartments: path.join(DATA_DIR, 'subdepartments.json'),
  staff: path.join(DATA_DIR, 'staff.json'),
  requests: path.join(DATA_DIR, 'requests.json'),
  notifications: path.join(DATA_DIR, 'notifications.json'),
  institutions: path.join(DATA_DIR, 'institutions.json'),
  otps: path.join(DATA_DIR, 'otps.json'),
  auditLogs: path.join(DATA_DIR, 'audit_logs.json'),
  announcements: path.join(DATA_DIR, 'announcements.json'),
};

let localDataInitialized = false;

function ensureLocalDataDir(): boolean {
  if (IS_SERVERLESS || process.env.NODE_ENV === 'production') {
    return false;
  }
  if (localDataInitialized) return true;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    Object.values(FILE_PATHS).forEach((filePath) => {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    });
    localDataInitialized = true;
    return true;
  } catch (err) {
    console.warn('[LocalDB] Could not initialize local .data directory:', (err as any)?.message || err);
    return false;
  }
}

// Helper for local file database read/write
const localDb = {
  read: <T>(key: keyof typeof FILE_PATHS): T[] => {
    try {
      if (!ensureLocalDataDir()) return [];
      const content = fs.readFileSync(FILE_PATHS[key], 'utf-8');
      return JSON.parse(content) as T[];
    } catch {
      return [];
    }
  },
  write: <T>(key: keyof typeof FILE_PATHS, data: T[]): void => {
    if (process.env.NODE_ENV === 'production' || IS_SERVERLESS) {
      throw new Error(`[CRITICAL DATA PROTECTION] Attempted write to local JSON file '${key}.json' in production/serverless mode is strictly prohibited.`);
    }
    ensureLocalDataDir();
    fs.writeFileSync(FILE_PATHS[key], JSON.stringify(data, null, 2));
  }
};

// MongoDB schemas (if MongoDB is used)
const InstitutionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  category: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  website: { type: String, default: '' },
  logo: { type: String, default: '' },
  officialEmail: { type: String, default: '' },
  contactNumber: { type: String, default: '' },
  description: { type: String, default: '' },
  socialTwitter: { type: String, default: '' },
  socialLinkedin: { type: String, default: '' },
  socialFacebook: { type: String, default: '' },
  isTest: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive', 'test'], default: 'active' },
  createdAt: { type: String, required: true },
  updatedAt: { type: String },
});

const StudentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  enrollmentNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  password: { type: String, required: true },
  institutionId: { type: String, default: 'default' },
  createdAt: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: String },
});
StudentSchema.index({ institutionId: 1, enrollmentNumber: 1 });

const DepartmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  key: { type: String, required: true },
  name: { type: String, required: true },
  officialPhone: { type: String, required: true },
  officialEmail: { type: String, required: true },
  description: { type: String, default: '' },
  head: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  logo: { type: String, default: '' },
  institutionId: { type: String, default: 'default' },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
  additionalEmails: { type: String, default: '' },
});

DepartmentSchema.index({ key: 1, institutionId: 1 }, { unique: true });
DepartmentSchema.index({ username: 1, institutionId: 1 }, { unique: true });

const StaffSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String },
  departmentKey: { type: String, required: true },
  role: { type: String, enum: ['staff', 'superadmin'], required: true },
  disabled: { type: Boolean, default: false },
  institutionId: { type: String, default: 'default' },
  createdAt: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: String },
  username: { type: String },
  lastLogin: { type: String },
  lastLogout: { type: String },
  lastLoginIp: { type: String },
  lastLoginDevice: { type: String },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: String },
  forcePasswordChange: { type: Boolean, default: false },
  passwordResetHistory: [{ timestamp: { type: String } }],
  passwordType: { type: String, enum: ['temporary', 'permanent'], default: 'permanent' },
  employeeId: { type: String },
  phone: { type: String },
  designation: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
});

StaffSchema.index({ email: 1, institutionId: 1 }, { unique: true });

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  adminId: { type: String, required: true },
  adminName: { type: String, required: true },
  actionType: { type: String, required: true },
  departmentKey: { type: String },
  details: { type: String },
  timestamp: { type: String, required: true },
  ipAddress: { type: String },
  institutionId: { type: String, required: true }
});
AuditLogSchema.index({ institutionId: 1, timestamp: -1 });

const RequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  enrollmentNumber: { type: String, required: true },
  contactNumber: { type: String, required: true },
  departmentKey: { type: String, required: true },
  requestType: { type: String, enum: ['complaint', 'help'], required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [{ type: String }],
  status: { type: String, enum: ['pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed'], required: true },
  remarks: { type: String },
  resolvedAt: { type: String },
  institutionId: { type: String, default: 'default' },
  createdAt: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  officerId: { type: String },
  officerName: { type: String },
  expectedResolutionTime: { type: String },
  internalNotes: { type: String },
  subDepartmentId: { type: String },
  subDepartmentName: { type: String },
  feedback: {
    rating: { type: Number },
    remarks: { type: String },
    createdAt: { type: String }
  },
  timeline: [{
    step: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    timestamp: { type: String, required: true },
    actor: { type: String },
    remarks: { type: String },
    statusChange: { type: String }
  }],
  updatedAt: { type: String }
});
RequestSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
RequestSchema.index({ institutionId: 1, studentId: 1, createdAt: -1 });
RequestSchema.index({ institutionId: 1, departmentKey: 1, status: 1 });

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientId: { type: String, required: true },
  recipientRole: { type: String, enum: ['student', 'staff', 'all'], required: true },
  isRead: { type: Boolean, default: false },
  institutionId: { type: String, default: 'default' },
  createdAt: { type: String, required: true },
  announcementId: { type: String },
});
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ institutionId: 1, recipientRole: 1, createdAt: -1 });

const OtpSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  institutionId: { type: String, required: true },
  email: { type: String, required: true },
  otpHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  resendCount: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
});
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AnnouncementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  announcementId: { type: String, required: true },
  institutionId: { type: String, required: true },
  departmentId: { type: String, default: null },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  attachmentUrl: { type: String },
  attachmentName: { type: String },
  attachmentMimeType: { type: String },
  attachmentSize: { type: Number },
  attachmentData: { type: String },
  createdBy: { type: String, required: true },
  creatorRole: { type: String, enum: ['staff', 'superadmin'], required: true },
  publishDate: { type: String, required: true },
  expiryDate: { type: String },
  isPublished: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  targetAudience: { type: String, enum: ['institution', 'selected_departments', 'all'], required: true },
  targetDepartments: [{ type: String }],
  notifyStudents: { type: Boolean, default: false },
  notifyStaff: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
  updatedAt: { type: String },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: String },
  deletedBy: { type: String },
  deleteReason: { type: String },
});
AnnouncementSchema.index({ institutionId: 1, isPublished: 1, isDeleted: 1, createdAt: -1 });

const SubDepartmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  headName: { type: String, required: true },
  officialEmail: { type: String, required: true },
  contactNumber: { type: String, required: true },
  officeLocation: { type: String },
  description: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  departmentKey: { type: String, required: true },
  institutionId: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String },
});

SubDepartmentSchema.index({ name: 1, departmentKey: 1, institutionId: 1 }, { unique: true });

// Declare Mongoose models
let StudentModel: mongoose.Model<any>;
let DepartmentModel: mongoose.Model<any>;
let SubDepartmentModel: mongoose.Model<any>;
let StaffModel: mongoose.Model<any>;
let RequestModel: mongoose.Model<any>;
let NotificationModel: mongoose.Model<any>;
let InstitutionModel: mongoose.Model<any>;
let OtpModel: mongoose.Model<any>;
let AuditLogModel: mongoose.Model<any>;
let AnnouncementModel: mongoose.Model<any>;

try {
  StudentModel = mongoose.model('Student', StudentSchema);
  DepartmentModel = mongoose.model('Department', DepartmentSchema);
  SubDepartmentModel = mongoose.model('SubDepartment', SubDepartmentSchema);
  StaffModel = mongoose.model('Staff', StaffSchema);
  RequestModel = mongoose.model('Request', RequestSchema);
  NotificationModel = mongoose.model('Notification', NotificationSchema);
  InstitutionModel = mongoose.model('Institution', InstitutionSchema);
  OtpModel = mongoose.model('Otp', OtpSchema);
  AuditLogModel = mongoose.model('AuditLog', AuditLogSchema);
  AnnouncementModel = mongoose.model('Announcement', AnnouncementSchema);
} catch {
  StudentModel = mongoose.models.Student;
  DepartmentModel = mongoose.models.Department;
  SubDepartmentModel = mongoose.models.SubDepartment;
  StaffModel = mongoose.models.Staff;
  RequestModel = mongoose.models.Request;
  NotificationModel = mongoose.models.Notification;
  InstitutionModel = mongoose.models.Institution;
  OtpModel = mongoose.models.Otp;
  AuditLogModel = mongoose.models.AuditLog;
  AnnouncementModel = mongoose.models.Announcement;
}

// Custom Error for Database Unavailability in Atlas Mode
export class DatabaseUnavailableError extends Error {
  statusCode: number;
  isDatabaseUnavailable: boolean;
  constructor(message = 'Database service is temporarily unavailable. Connection to MongoDB Atlas is recovering. Please retry shortly.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.statusCode = 503;
    this.isDatabaseUnavailable = true;
  }
}

export interface StorageConfigValidationResult {
  isValid: boolean;
  isProduction: boolean;
  storageMode: 'atlas' | 'local';
  error?: string;
}

export function validateStorageConfiguration(env: NodeJS.ProcessEnv = process.env): StorageConfigValidationResult {
  const isProduction = env.NODE_ENV === 'production';
  const rawMongoUri = env.MONGODB_URI ? env.MONGODB_URI.trim() : '';
  const rawStorageMode = env.STORAGE_MODE ? env.STORAGE_MODE.trim().toLowerCase() : '';

  if (isProduction) {
    // 1. STORAGE_MODE=local is strictly forbidden in production
    if (rawStorageMode === 'local') {
      return {
        isValid: false,
        isProduction: true,
        storageMode: 'atlas',
        error: '[CRITICAL CONFIGURATION ERROR] STORAGE_MODE=local is strictly forbidden in production. Production environments must strictly use MongoDB Atlas to prevent writes to ephemeral local storage.'
      };
    }

    // 2. MONGODB_URI must be present and non-empty in production
    if (!rawMongoUri) {
      return {
        isValid: false,
        isProduction: true,
        storageMode: 'atlas',
        error: '[CRITICAL CONFIGURATION ERROR] MONGODB_URI is required and cannot be empty in production. Local JSON fallback is forbidden in production.'
      };
    }

    // 3. MONGODB_URI must have a valid protocol scheme
    if (!rawMongoUri.startsWith('mongodb://') && !rawMongoUri.startsWith('mongodb+srv://')) {
      return {
        isValid: false,
        isProduction: true,
        storageMode: 'atlas',
        error: '[CRITICAL CONFIGURATION ERROR] MONGODB_URI has an invalid scheme in production. It must begin with mongodb:// or mongodb+srv://.'
      };
    }

    return {
      isValid: true,
      isProduction: true,
      storageMode: 'atlas'
    };
  }

  // Development / Test mode rules
  if (rawStorageMode === 'local') {
    return {
      isValid: true,
      isProduction: false,
      storageMode: 'local'
    };
  }

  if (rawMongoUri) {
    return {
      isValid: true,
      isProduction: false,
      storageMode: 'atlas'
    };
  }

  // Development fallback when MONGODB_URI is absent
  return {
    isValid: true,
    isProduction: false,
    storageMode: 'local'
  };
}

export function isAtlasConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const validation = validateStorageConfiguration(env);
  if (validation.isProduction) {
    // In production, Atlas is the ONLY permissible storage mode
    return true;
  }
  return validation.storageMode === 'atlas';
}

export function getStorageMode(operation: 'read' | 'write' = 'read'): 'atlas' | 'local' {
  if (isAtlasConfigured()) {
    const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
    if (readyState !== 1) {
      const state = readyState === 2 ? 'reconnecting' : 'disconnected';
      throw new DatabaseUnavailableError(
        `Database service is temporarily unavailable (${state} to MongoDB Atlas). Please retry in a few moments.`
      );
    }
    return 'atlas';
  }
  return 'local';
}

// Database Connection Status
export let isMongoConnected = false;
export let lastConnectionTime: string | null = null;
export let currentPublicIp: string | null = null;
export let lastErrorDiagnostic: string | null = null;

let lastPublicIpCheck = 0;
let eventListenersRegistered = false;
let connectionAttempts = 0;
let isConnecting = false;
let connectionPromise: Promise<boolean> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

export async function detectPublicIp(): Promise<string | null> {
  if (IS_SERVERLESS) return currentPublicIp;
  if (currentPublicIp && Date.now() - lastPublicIpCheck < 60000) {
    return currentPublicIp;
  }
  const providers = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
    'https://ifconfig.me/ip',
  ];
  for (const url of providers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        const ip = text.startsWith('{') ? JSON.parse(text).ip : text.trim();
        if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
          currentPublicIp = ip;
          lastPublicIpCheck = Date.now();
          return currentPublicIp;
        }
      }
    } catch {}
  }
  return currentPublicIp;
}

// Trigger initial background detection on module load only in persistent server runtimes
if (!IS_SERVERLESS) {
  detectPublicIp().catch(() => {});
}

function registerConnectionEvents() {
  if (eventListenersRegistered) return;
  eventListenersRegistered = true;

  mongoose.connection.on('connected', () => {
    isMongoConnected = true;
    lastConnectionTime = new Date().toISOString();
    connectionAttempts = 0;
    lastErrorDiagnostic = null;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    console.log('+++ Database Connected: Established active connection to MongoDB Atlas. +++');
  });

  mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
    console.log('--- Database Notice: MongoDB Atlas connection disconnected. ---');
    if (!isShuttingDown && isAtlasConfigured()) {
      scheduleReconnect();
    }
  });

  mongoose.connection.on('reconnected', () => {
    isMongoConnected = true;
    lastConnectionTime = new Date().toISOString();
    connectionAttempts = 0;
    lastErrorDiagnostic = null;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    console.log('+++ Database Reconnected: Re-established connection to MongoDB Atlas. +++');
  });

  mongoose.connection.on('error', (err) => {
    isMongoConnected = (mongoose.connection.readyState === 1);
    const sanitizedMsg = String(err?.message || err).replace(/:([^:@]+)@/, ':***@');
    if (sanitizedMsg.includes('SSL routines') || sanitizedMsg.includes('alert number 80')) {
      lastErrorDiagnostic = `TLS/SSL handshake rejected by MongoDB Atlas (SSL alert 80). The current runtime IP (${currentPublicIp || 'detecting...'}) is not in the Atlas IP Access List.`;
      console.warn(`[DB Notice] Atlas TLS handshake rejected (SSL alert 80). Outbound IP is ${currentPublicIp || 'detecting...'}.`);
    } else {
      lastErrorDiagnostic = sanitizedMsg;
      console.error('[DB Event Error]', sanitizedMsg);
    }
  });

  const handleExit = async () => {
    isShuttingDown = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.close();
      } catch {}
    }
  };

  process.once('SIGINT', handleExit);
  process.once('SIGTERM', handleExit);
}

function scheduleReconnect(customDelay?: number) {
  if (isShuttingDown || !isAtlasConfigured() || IS_SERVERLESS) return;
  if (mongoose.connection.readyState === 1) return;
  if (retryTimer) return; // Prevent duplicate retry loops

  // Exponential backoff: 3s, 5s, 8s, 12s, 18s, max 30s
  const delay = customDelay || Math.min(3000 * Math.pow(1.5, Math.min(connectionAttempts, 6)), 30000);
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (mongoose.connection.readyState !== 1 && !isConnecting && !isShuttingDown) {
      await connectToDatabase(false).catch(() => {});
    }
  }, delay);
}

export function getDatabaseDiagnostics() {
  const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
  const isAtlas = isAtlasConfigured();
  
  let status: 'connected' | 'reconnecting' | 'disconnected' | 'local';
  let modeDescription: string;
  
  if (!isAtlas) {
    status = 'local';
    modeDescription = 'Local JSON Development Mode';
  } else if (readyState === 1) {
    status = 'connected';
    modeDescription = 'MongoDB Atlas Connected';
  } else if (readyState === 2 || isConnecting || retryTimer !== null) {
    status = 'reconnecting';
    modeDescription = 'MongoDB Atlas Reconnecting';
  } else {
    status = 'disconnected';
    modeDescription = 'MongoDB Atlas Disconnected';
  }

  const effectiveDatabaseName = (mongoose.connection && mongoose.connection.name) ? mongoose.connection.name : 'campusconnect';

  return {
    isMongoConnected: isAtlas ? readyState === 1 : false,
    connected: isAtlas ? readyState === 1 : true,
    status,
    mode: modeDescription,
    storageMode: isAtlas ? 'atlas' : 'local',
    effectiveDatabaseName,
    readyState,
    retryAttempts: connectionAttempts,
    isReconnecting: isAtlas && readyState !== 1 && (isConnecting || retryTimer !== null),
    lastConnectionTime,
    currentPublicIp,
    lastError: lastErrorDiagnostic,
    ipAccessRequired: isAtlas && readyState !== 1 && currentPublicIp ? `${currentPublicIp}/32` : null,
  };
}

async function handleOneTimeReset() {
  console.log('[DB-RESET] Automatic database reset/cleanup is disabled to preserve persistent production data.');
}

export async function connectToDatabase(isInitial = false): Promise<boolean> {
  if (isShuttingDown) return false;
  registerConnectionEvents();

  const config = validateStorageConfiguration();
  if (!config.isValid) {
    console.error(`[DB Configuration Error] ${config.error}`);
    return false;
  }

  if (!isAtlasConfigured()) {
    isMongoConnected = false;
    console.log('--- Database Info: Operating in explicit local JSON storage mode (.data/). ---');
    await handleOneTimeReset();
    await seedDatabase();
    return true;
  }

  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return true;
  }

  // De-duplicate: If a connection attempt is already in flight, await the same promise
  if (connectionPromise) {
    return connectionPromise;
  }

  // Clear any existing retry timer because we are connecting now
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  isConnecting = true;
  lastConnectionTime = new Date().toISOString();
  if (!IS_SERVERLESS) {
    detectPublicIp().catch(() => {});
  }
  const uri = process.env.MONGODB_URI!;

  const defaultMaxPool = IS_SERVERLESS ? '10' : '50';
  const defaultMinPool = IS_SERVERLESS ? '0' : '5';

  connectionPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || defaultMaxPool, 10),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || defaultMinPool, 10),
        maxConnecting: IS_SERVERLESS ? 3 : 5,
        waitQueueTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      isMongoConnected = true;
      connectionAttempts = 0;
      lastErrorDiagnostic = null;
      console.log('+++ Database Connected: Successfully connected to MongoDB Atlas. +++');

      // Drop old unique global index on email if it exists
      if (mongoose.models.Staff) {
        try {
          await mongoose.models.Staff.collection.dropIndex('email_1');
          console.log('[DB] Programmatically dropped unique email_1 index from Staff collection.');
        } catch (e) {
          // Index might not exist or failed to drop, ignore
        }
      }

      await handleOneTimeReset();
      await seedDatabase();
      return true;
    } catch (error: any) {
      isMongoConnected = false;
      connectionAttempts++;
      const rawMsg = String(error?.message || error);
      const isWhitelist = error?.name === 'MongooseServerSelectionError' || rawMsg.includes('whitelist') || rawMsg.includes('alert number 80');
      if (isWhitelist) {
        lastErrorDiagnostic = `Atlas IP Access List rejection. Current outbound IP is ${currentPublicIp || 'detecting...'}.`;
      } else {
        lastErrorDiagnostic = rawMsg.replace(/:([^:@]+)@/, ':***@');
      }
      const nextDelay = Math.min(3000 * Math.pow(1.5, Math.min(connectionAttempts - 1, 6)), 30000);

      if (isInitial || connectionAttempts <= 3 || connectionAttempts % 5 === 0) {
        if (isWhitelist) {
          console.warn(`[DB Notice] MongoDB Atlas access pending IP Access List for ${currentPublicIp || 'current IP'} (attempt ${connectionAttempts}). Retrying in ${Math.round(nextDelay / 1000)}s...`);
        } else {
          const sanitized = rawMsg.replace(/:([^:@]+)@/, ':***@');
          console.warn(`[DB Notice] MongoDB Atlas connection attempt ${connectionAttempts} failed (${sanitized}). Retrying in ${Math.round(nextDelay / 1000)}s...`);
        }
      }

      scheduleReconnect(nextDelay);
      return false;
    } finally {
      isConnecting = false;
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

export async function closeDatabase(): Promise<void> {
  isShuttingDown = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
    } catch {}
  }
}

// Initial Core Seed Data
const DEFAULT_DEPARTMENTS: Omit<Department, 'id'>[] = [
  { key: 'academic', name: 'Academic Department', officialPhone: '+1 (555) 0192', officialEmail: 'academic@campusconnect.edu', description: 'Handles course registrations, attendance, curriculum coordination, and syllabus inquiries.' },
  { key: 'accounts', name: 'Accounts Department', officialPhone: '+1 (555) 0129', officialEmail: 'accounts@campusconnect.edu', description: 'Manages tuition schedules, scholarship applications, fee receipts, and official clearances.' },
  { key: 'library', name: 'Library Department', officialPhone: '+1 (555) 0166', officialEmail: 'library@campusconnect.edu', description: 'Resolves card issues, book reservations, fine disbursements, and digital archive clearances.' },
  { key: 'hostel', name: 'Hostel Department', officialPhone: '+1 (555) 0157', officialEmail: 'hostel@campusconnect.edu', description: 'Administers room allocation, maintenance logs, hostel regulations, and boarding credentials.' },
  { key: 'transport', name: 'Transport Department', officialPhone: '+1 (555) 0199', officialEmail: 'transport@campusconnect.edu', description: 'Manages campus buses, scheduling delays, parking decals, and transit complaints.' },
  { key: 'placement', name: 'Training & Placement Department', officialPhone: '+1 (555) 0175', officialEmail: 'placement@campusconnect.edu', description: 'Drives career opportunities, corporate alignments, interview schedules, and training milestones.' },
  { key: 'examination', name: 'Examination Department', officialPhone: '+1 (555) 0184', officialEmail: 'exams@campusconnect.edu', description: 'Coordinates terminal assessments, grade point calculations, report cards, and re-evaluations.' },
  { key: 'administration', name: 'Administration Department', officialPhone: '+1 (555) 0110', officialEmail: 'admin@campusconnect.edu', description: 'Oversees facilities operation, security logs, general clearance, and official document certifications.' },
  { key: 'itsupport', name: 'IT Support Department', officialPhone: '+1 (555) 0138', officialEmail: 'itsupport@campusconnect.edu', description: 'Addresses network outages, campus email locks, software setups, and systems maintenance.' },
];

export async function ensureDepartmentsExist(institutionId: string): Promise<void> {
  const instId = institutionId || 'default';
  let exists = false;
  if (getStorageMode() === 'atlas') {
    // Check if any departments already exist for this institution
    const count = await DepartmentModel.countDocuments({ institutionId: instId });
    exists = count > 0;
  } else {
    const list = localDb.read<Department>('departments');
    exists = list.some(d => (d.institutionId || 'default') === instId);
  }

  // Seed default departments ONLY if they do not exist for this institution yet (empty collection state for this scope)
  // Never delete existing departments, and never recreate/overwrite them.
  if (!exists) {
    console.log(`[DB] Seeding default departments for institution: ${instId}`);
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const departmentsToCreate = DEFAULT_DEPARTMENTS.map((dept, idx) => ({
      ...dept,
      id: `dept-${instId}-${dept.key}`,
      institutionId: instId,
      status: 'active' as const,
      head: '',
      logo: '',
      username: dept.key,
      password: defaultPasswordHash,
    }));

    if (getStorageMode() === 'atlas') {
      await DepartmentModel.insertMany(departmentsToCreate);
    } else {
      const list = localDb.read<Department>('departments');
      list.push(...(departmentsToCreate as any));
      localDb.write('departments', list);
    }
  }
}

export async function ensureStaffExist(institutionId: string): Promise<void> {
  // Deprecated under redesigned dynamic staff architecture
}

async function seedDatabase() {
  // Completely empty no-op function to avoid seeding mock / dummy data in a fresh production environment
}

// Unified Database Repository Export
export const db = {
  students: {
    findMany: async (filter?: { institutionId?: string }): Promise<(Omit<Student, 'createdAt'> & { totalRequestsCount?: number, institutionId?: string })[]> => {
      if (getStorageMode() === 'atlas') {
        const query: any = {};
        if (filter?.institutionId) {
          if (filter.institutionId === 'default') {
            query.$or = [{ institutionId: 'default' }, { institutionId: { $exists: false } }, { institutionId: null }, { institutionId: '' }];
          } else {
            query.institutionId = filter.institutionId;
          }
        }
        const list = await StudentModel.find(query).lean();
        return list.map(item => ({
          id: item.id,
          name: item.name,
          enrollmentNumber: item.enrollmentNumber,
          email: item.email,
          contactNumber: item.contactNumber,
          institutionId: item.institutionId || 'default',
        }));
      } else {
        let list = localDb.read<any>('students');
        if (filter?.institutionId) {
          list = list.filter(item => (item.institutionId || 'default') === filter.institutionId);
        }
        return list.map(item => ({
          id: item.id,
          name: item.name,
          enrollmentNumber: item.enrollmentNumber,
          email: item.email,
          contactNumber: item.contactNumber,
          institutionId: item.institutionId || 'default',
        }));
      }
    },
    findByEnrollment: async (enrollmentNumber: string, institutionId?: string) => {
      const cleanEnroll = enrollmentNumber.trim().toUpperCase();

      if (institutionId && institutionId !== 'default') {
        if (getStorageMode() === 'atlas') {
          return await StudentModel.findOne({ enrollmentNumber: cleanEnroll, institutionId }).lean();
        } else {
          const list = localDb.read<any>('students');
          return list.find(s => s.enrollmentNumber && s.enrollmentNumber.toUpperCase() === cleanEnroll && (s.institutionId || 'default') === institutionId) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await StudentModel.findOne({ enrollmentNumber: cleanEnroll }).lean();
      } else {
        const list = localDb.read<any>('students');
        return list.find(s => s.enrollmentNumber && s.enrollmentNumber.toUpperCase() === cleanEnroll) || null;
      }
    },
    findByEmail: async (email: string, institutionId?: string) => {
      const cleanEmail = email.toLowerCase().trim();
      if (institutionId && institutionId !== 'default') {
        if (getStorageMode() === 'atlas') {
          return await StudentModel.findOne({ email: cleanEmail, institutionId }).lean();
        } else {
          const list = localDb.read<any>('students');
          return list.find(s => s.email && s.email.toLowerCase() === cleanEmail && (s.institutionId || 'default') === institutionId) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await StudentModel.findOne({ email: cleanEmail }).lean();
      } else {
        const list = localDb.read<any>('students');
        return list.find(s => s.email && s.email.toLowerCase() === cleanEmail) || null;
      }
    },
    findById: async (id: string) => {
      if (getStorageMode() === 'atlas') {
        return await StudentModel.findOne({ id }).lean();
      } else {
        const list = localDb.read<any>('students');
        return list.find(s => s.id === id) || null;
      }
    },
    create: async (studentData: any) => {
      const id = 'student-' + Date.now();
      const completeData = { ...studentData, id, createdAt: new Date().toISOString() };
      if (getStorageMode() === 'atlas') {
        const doc = new StudentModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('students');
        list.push(completeData);
        localDb.write('students', list);
        return completeData;
      }
    },
    delete: async (id: string) => {
      if (getStorageMode() === 'atlas') {
        await StudentModel.deleteOne({ id });
      } else {
        const list = localDb.read<any>('students');
        const filtered = list.filter(item => item.id !== id);
        localDb.write('students', filtered);
      }
    },
    deleteScoped: async (id: string, institutionId: string) => {
      if (!id || !institutionId) return null;
      if (getStorageMode('write') === 'atlas') {
        const query: any = { id };
        if (institutionId === 'default') {
          query.$or = [
            { institutionId: 'default' },
            { institutionId: { $exists: false } },
            { institutionId: null },
            { institutionId: '' }
          ];
        } else {
          query.institutionId = institutionId;
        }
        const deleted = await StudentModel.findOneAndDelete(query).lean();
        return deleted;
      } else {
        const list = localDb.read<any>('students');
        const targetInst = institutionId || 'default';
        const idx = list.findIndex(item => 
          item.id === id && 
          ((item.institutionId || 'default') === targetInst)
        );
        if (idx !== -1) {
          const [deleted] = list.splice(idx, 1);
          localDb.write('students', list);
          return deleted;
        }
        return null;
      }
    },
    update: async (id: string, updates: any) => {
      if (getStorageMode() === 'atlas') {
        return await StudentModel.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
      } else {
        const list = localDb.read<any>('students');
        const idx = list.findIndex(item => item.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates };
          localDb.write('students', list);
          return list[idx];
        }
        return null;
      }
    },
    findByResetToken: async (token: string) => {
      if (getStorageMode() === 'atlas') {
        return await StudentModel.findOne({ resetPasswordToken: token }).lean();
      } else {
        const list = localDb.read<any>('students');
        return list.find(s => s.resetPasswordToken === token) || null;
      }
    },
  },

  departments: {
    findMany: async (institutionId?: string): Promise<Department[]> => {
      if (institutionId) {
        await ensureDepartmentsExist(institutionId);
        if (getStorageMode() === 'atlas') {
          return await DepartmentModel.find({ institutionId }).lean();
        } else {
          return localDb.read<Department>('departments').filter(d => (d.institutionId || 'default') === institutionId);
        }
      } else {
        if (getStorageMode() === 'atlas') {
          return await DepartmentModel.find().lean();
        } else {
          return localDb.read<Department>('departments');
        }
      }
    },
    findByKey: async (key: string, institutionId?: string): Promise<Department | null> => {
      const instId = institutionId || 'default';
      await ensureDepartmentsExist(instId);
      if (getStorageMode() === 'atlas') {
        return await DepartmentModel.findOne({ key, institutionId: instId }).lean();
      } else {
        return localDb.read<Department>('departments').find(d => d.key === key && (d.institutionId || 'default') === instId) || null;
      }
    },
    findByUsername: async (username: string, institutionId?: string): Promise<Department | null> => {
      const cleanUser = username.toLowerCase().trim();
      if (institutionId && institutionId !== 'default') {
        if (getStorageMode() === 'atlas') {
          return await DepartmentModel.findOne({ username: cleanUser, institutionId }).lean();
        } else {
          const list = localDb.read<Department>('departments');
          return list.find(d => d.username && d.username.toLowerCase() === cleanUser && (d.institutionId || 'default') === institutionId) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await DepartmentModel.findOne({ username: cleanUser }).lean();
      } else {
        const list = localDb.read<Department>('departments');
        return list.find(d => d.username && d.username.toLowerCase() === cleanUser) || null;
      }
    },
    findByEmail: async (email: string, institutionId?: string): Promise<Department | null> => {
      const cleanEmail = email.toLowerCase().trim();
      if (institutionId && institutionId !== 'default') {
        if (getStorageMode() === 'atlas') {
          return await DepartmentModel.findOne({ officialEmail: cleanEmail, institutionId }).lean();
        } else {
          const list = localDb.read<Department>('departments');
          return list.find(d => d.officialEmail && d.officialEmail.toLowerCase() === cleanEmail && (d.institutionId || 'default') === institutionId) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await DepartmentModel.findOne({ officialEmail: cleanEmail }).lean();
      } else {
        const list = localDb.read<Department>('departments');
        return list.find(d => d.officialEmail && d.officialEmail.toLowerCase() === cleanEmail) || null;
      }
    },
    findById: async (id: string): Promise<Department | null> => {
      if (getStorageMode() === 'atlas') {
        return await DepartmentModel.findOne({ id }).lean();
      } else {
        return localDb.read<Department>('departments').find(d => d.id === id) || null;
      }
    },
    create: async (deptData: any) => {
      const id = 'dept-' + Date.now();
      const completeData = { ...deptData, id };
      if (getStorageMode() === 'atlas') {
        const doc = new DepartmentModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('departments');
        list.push(completeData);
        localDb.write('departments', list);
        return completeData;
      }
    },
    update: async (key: string, updates: any, institutionId?: string) => {
      const instId = institutionId || 'default';
      if (getStorageMode() === 'atlas') {
        let res = await DepartmentModel.findOneAndUpdate({ key, institutionId: instId }, { $set: updates }, { new: true }).lean();
        if (!res) {
          res = await DepartmentModel.findOneAndUpdate({ id: key, institutionId: instId }, { $set: updates }, { new: true }).lean();
        }
        return res;
      } else {
        const list = localDb.read<any>('departments');
        let idx = list.findIndex(item => item.key === key && (item.institutionId || 'default') === instId);
        if (idx === -1) {
          idx = list.findIndex(item => item.id === key && (item.institutionId || 'default') === instId);
        }
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates };
          localDb.write('departments', list);
          return list[idx];
        }
        return null;
      }
    },
    delete: async (id: string) => {
      if (getStorageMode() === 'atlas') {
        await DepartmentModel.deleteOne({ id });
      } else {
        const list = localDb.read<any>('departments');
        const filtered = list.filter(item => item.id !== id);
        localDb.write('departments', filtered);
      }
    }
  },

  subdepartments: {
    findMany: async (filter: Partial<SubDepartment> = {}): Promise<SubDepartment[]> => {
      if (getStorageMode() === 'atlas') {
        return await SubDepartmentModel.find(filter).lean();
      } else {
        let list = localDb.read<SubDepartment>('subdepartments') || [];
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] === val);
        });
        return list;
      }
    },
    findById: async (id: string): Promise<SubDepartment | null> => {
      if (getStorageMode() === 'atlas') {
        return await SubDepartmentModel.findOne({ id }).lean();
      } else {
        const list = localDb.read<SubDepartment>('subdepartments') || [];
        return list.find(s => s.id === id) || null;
      }
    },
    create: async (subData: Omit<SubDepartment, 'id' | 'createdAt'>): Promise<SubDepartment> => {
      const id = 'subdept-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const completeData: SubDepartment = {
        ...subData,
        id,
        createdAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        const doc = new SubDepartmentModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<SubDepartment>('subdepartments') || [];
        list.push(completeData);
        localDb.write('subdepartments', list);
        return completeData;
      }
    },
    update: async (id: string, updates: Partial<SubDepartment>): Promise<SubDepartment | null> => {
      const completeUpdates = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        return await SubDepartmentModel.findOneAndUpdate({ id }, { $set: completeUpdates }, { new: true }).lean();
      } else {
        const list = localDb.read<SubDepartment>('subdepartments') || [];
        const idx = list.findIndex(s => s.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...completeUpdates };
          localDb.write('subdepartments', list);
          return list[idx];
        }
        return null;
      }
    },
    delete: async (id: string): Promise<boolean> => {
      if (getStorageMode() === 'atlas') {
        const res = await SubDepartmentModel.deleteOne({ id });
        return res.deletedCount > 0;
      } else {
        const list = localDb.read<SubDepartment>('subdepartments') || [];
        const filtered = list.filter(s => s.id !== id);
        if (filtered.length !== list.length) {
          localDb.write('subdepartments', filtered);
          return true;
        }
        return false;
      }
    }
  },

  staff: {
    findMany: async (filter: any = {}): Promise<any[]> => {
      if (filter.institutionId) {
        await ensureStaffExist(filter.institutionId);
      }
      if (getStorageMode() === 'atlas') {
        return await StaffModel.find(filter).lean();
      } else {
        let list = localDb.read<any>('staff');
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] === val);
        });
        return list;
      }
    },
    findByEmail: async (email: string, institutionId?: string) => {
      const cleanEmail = email.toLowerCase().trim();
      if (institutionId && institutionId !== 'default') {
        await ensureStaffExist(institutionId);
        if (getStorageMode() === 'atlas') {
          return await StaffModel.findOne({ email: cleanEmail, institutionId }).lean();
        } else {
          const list = localDb.read<any>('staff');
          return list.find(s => 
            s.email && s.email.toLowerCase() === cleanEmail &&
            (s.institutionId || 'default') === institutionId
          ) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await StaffModel.findOne({ email: cleanEmail }).lean();
      } else {
        const list = localDb.read<any>('staff');
        return list.find(s => s.email && s.email.toLowerCase() === cleanEmail) || null;
      }
    },
    findByUsername: async (username: string, institutionId?: string) => {
      const cleanUser = username.toLowerCase().trim();
      if (institutionId && institutionId !== 'default') {
        await ensureStaffExist(institutionId);
        if (getStorageMode() === 'atlas') {
          return await StaffModel.findOne({ username: cleanUser, institutionId }).lean();
        } else {
          const list = localDb.read<any>('staff');
          return list.find(s => 
            s.username && s.username.toLowerCase() === cleanUser &&
            (s.institutionId || 'default') === institutionId
          ) || null;
        }
      }

      if (getStorageMode() === 'atlas') {
        return await StaffModel.findOne({ username: cleanUser }).lean();
      } else {
        const list = localDb.read<any>('staff');
        return list.find(s => s.username && s.username.toLowerCase() === cleanUser) || null;
      }
    },
    findById: async (id: string) => {
      if (getStorageMode() === 'atlas') {
        return await StaffModel.findOne({ id }).lean();
      } else {
        const list = localDb.read<any>('staff');
        return list.find(s => s.id === id) || null;
      }
    },
    create: async (staffData: any) => {
      const id = 'staff-' + Date.now();
      const completeData = { ...staffData, id, createdAt: new Date().toISOString() };
      if (getStorageMode() === 'atlas') {
        const doc = new StaffModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('staff');
        list.push(completeData);
        localDb.write('staff', list);
        return completeData;
      }
    },
    update: async (id: string, updates: any) => {
      if (getStorageMode() === 'atlas') {
        return await StaffModel.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
      } else {
        const list = localDb.read<any>('staff');
        const idx = list.findIndex(item => item.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates };
          localDb.write('staff', list);
          return list[idx];
        }
        return null;
      }
    },
    delete: async (id: string) => {
      if (getStorageMode() === 'atlas') {
        await StaffModel.deleteOne({ id });
      } else {
        const list = localDb.read<any>('staff');
        const filtered = list.filter(item => item.id !== id);
        localDb.write('staff', filtered);
      }
    },
    findByResetToken: async (token: string) => {
      if (getStorageMode() === 'atlas') {
        return await StaffModel.findOne({ resetPasswordToken: token }).lean();
      } else {
        const list = localDb.read<any>('staff');
        return list.find(s => s.resetPasswordToken === token) || null;
      }
    },
  },

  auditLogs: {
    findMany: async (filter: any = {}): Promise<any[]> => {
      if (getStorageMode() === 'atlas') {
        return await AuditLogModel.find(filter).sort({ timestamp: -1 }).lean();
      } else {
        let list = localDb.read<any>('auditLogs') || [];
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] === val);
        });
        return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    },
    create: async (logData: any): Promise<any> => {
      const id = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const completeData = {
        ...logData,
        id,
        timestamp: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        const doc = new AuditLogModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('auditLogs') || [];
        list.push(completeData);
        localDb.write('auditLogs', list);
        return completeData;
      }
    }
  },

  requests: {
    findMany: async (filter: Partial<HelpComplaintRequest> = {}): Promise<HelpComplaintRequest[]> => {
      if (getStorageMode() === 'atlas') {
        return await RequestModel.find(filter).sort({ createdAt: -1 }).lean();
      } else {
        let list = localDb.read<HelpComplaintRequest>('requests');
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] === val);
        });
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    },
    findById: async (id: string): Promise<HelpComplaintRequest | null> => {
      if (getStorageMode() === 'atlas') {
        return await RequestModel.findOne({ id }).lean();
      } else {
        return localDb.read<HelpComplaintRequest>('requests').find(r => r.id === id) || null;
      }
    },
    create: async (reqData: Omit<HelpComplaintRequest, 'id' | 'createdAt'>): Promise<HelpComplaintRequest> => {
      const id = 'req-' + Date.now();
      const completeData: HelpComplaintRequest = {
        ...reqData,
        id,
        createdAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        const doc = new RequestModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<HelpComplaintRequest>('requests');
        list.push(completeData);
        localDb.write('requests', list);
        return completeData;
      }
    },
    update: async (id: string, updates: Partial<HelpComplaintRequest>): Promise<HelpComplaintRequest | null> => {
      if (getStorageMode() === 'atlas') {
        return await RequestModel.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
      } else {
        const list = localDb.read<HelpComplaintRequest>('requests');
        const idx = list.findIndex(r => r.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates };
          localDb.write('requests', list);
          return list[idx];
        }
        return null;
      }
    }
  },

  notifications: {
    findMany: async (filter: Partial<Notification> = {}): Promise<Notification[]> => {
      if (getStorageMode() === 'atlas') {
        return await NotificationModel.find(filter).sort({ createdAt: -1 }).lean();
      } else {
        let list = localDb.read<Notification>('notifications');
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] === val);
        });
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    },
    create: async (notifData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification> => {
      const id = 'notif-' + Date.now();
      const completeData: Notification = {
        ...notifData,
        id,
        isRead: false,
        createdAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        const doc = new NotificationModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<Notification>('notifications');
        list.push(completeData);
        localDb.write('notifications', list);
        return completeData;
      }
    },
    markAllAsRead: async (recipientId: string) => {
      if (getStorageMode() === 'atlas') {
        await NotificationModel.updateMany({ recipientId }, { $set: { isRead: true } });
      } else {
        const list = localDb.read<Notification>('notifications');
        const updated = list.map(item => {
          if (item.recipientId === recipientId) {
            return { ...item, isRead: true };
          }
          return item;
        });
        localDb.write('notifications', updated);
      }
    },
    update: async (id: string, updates: Partial<Notification>) => {
      if (getStorageMode() === 'atlas') {
        return await NotificationModel.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
      } else {
        const list = localDb.read<Notification>('notifications');
        const idx = list.findIndex(item => item.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates };
          localDb.write('notifications', list);
          return list[idx];
        }
        return null;
      }
    },
    deleteMany: async (filter: Partial<Notification>) => {
      if (getStorageMode() === 'atlas') {
        await NotificationModel.deleteMany(filter);
      } else {
        let list = localDb.read<Notification>('notifications');
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => (item as any)[k] !== val);
        });
        localDb.write('notifications', list);
      }
    }
  },

  institutions: {
    findMany: async (filter?: any): Promise<any[]> => {
      if (getStorageMode() === 'atlas') {
        return await InstitutionModel.find(filter || {}).lean();
      } else {
        const list = localDb.read<any>('institutions');
        if (!filter) return list;
        return list.filter(item => {
          return Object.entries(filter).every(([k, v]) => (item as any)[k] === v);
        });
      }
    },
    findById: async (id: string): Promise<any | null> => {
      if (getStorageMode() === 'atlas') {
        return await InstitutionModel.findOne({ id }).lean();
      } else {
        const list = localDb.read<any>('institutions');
        return list.find(inst => inst.id === id) || null;
      }
    },
    create: async (instData: any): Promise<any> => {
      const id = 'inst-' + Date.now();
      const completeData = {
        category: '',
        officialEmail: '',
        contactNumber: '',
        postalCode: '',
        description: '',
        socialTwitter: '',
        socialLinkedin: '',
        socialFacebook: '',
        isTest: false,
        status: 'active',
        ...instData,
        id,
        createdAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        const doc = new InstitutionModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('institutions');
        list.push(completeData);
        localDb.write('institutions', list);
        return completeData;
      }
    },
    update: async (id: string, updates: any): Promise<any | null> => {
      const completeUpdates = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      if (getStorageMode() === 'atlas') {
        return await InstitutionModel.findOneAndUpdate({ id }, { $set: completeUpdates }, { new: true }).lean();
      } else {
        const list = localDb.read<any>('institutions');
        const idx = list.findIndex(inst => inst.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...completeUpdates };
          localDb.write('institutions', list);
          return list[idx];
        }
        return null;
      }
    },
    delete: async (id: string): Promise<boolean> => {
      if (getStorageMode() === 'atlas') {
        await InstitutionModel.deleteOne({ id });
        await StudentModel.deleteMany({ institutionId: id });
        await DepartmentModel.deleteMany({ institutionId: id });
        await StaffModel.deleteMany({ institutionId: id });
        await RequestModel.deleteMany({ institutionId: id });
        await NotificationModel.deleteMany({ institutionId: id });
        await AnnouncementModel.deleteMany({ institutionId: id });
        await AuditLogModel.deleteMany({ institutionId: id });
        await OtpModel.deleteMany({ institutionId: id });
        return true;
      } else {
        // Delete from institutions
        const instList = localDb.read<any>('institutions');
        const filteredInst = instList.filter(inst => inst.id !== id);
        localDb.write('institutions', filteredInst);

        // Delete from other collections where institutionId === id
        const keysToDelete: (keyof typeof FILE_PATHS)[] = [
          'students',
          'departments',
          'staff',
          'requests',
          'notifications',
          'announcements',
          'auditLogs',
          'otps'
        ];

        keysToDelete.forEach(key => {
          const list = localDb.read<any>(key);
          const filtered = list.filter(item => {
            const instId = item.institutionId || 'default';
            return instId !== id;
          });
          localDb.write(key, filtered);
        });

        return true;
      }
    }
  },

  otps: {
    create: async (otpData: {
      institutionId: string;
      email: string;
      otpHash: string;
      expiresAt: Date;
      resendCount: number;
    }) => {
      const id = 'otp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
      const completeData = {
        id,
        institutionId: otpData.institutionId,
        email: otpData.email.toLowerCase(),
        otpHash: otpData.otpHash,
        createdAt: new Date(),
        expiresAt: otpData.expiresAt,
        attempts: 0,
        resendCount: otpData.resendCount,
        used: false,
      };

      if (getStorageMode() === 'atlas') {
        const doc = new OtpModel(completeData);
        await doc.save();
        return doc.toObject();
      } else {
        const list = localDb.read<any>('otps');
        list.push(completeData);
        localDb.write('otps', list);
        return completeData;
      }
    },
    findActive: async (institutionId: string, email: string): Promise<any | null> => {
      const now = new Date();
      if (getStorageMode() === 'atlas') {
        let doc = await OtpModel.findOne({
          institutionId,
          email: email.toLowerCase(),
          used: false,
          expiresAt: { $gt: now }
        }).sort({ createdAt: -1 }).lean();
        if (!doc) {
          doc = await OtpModel.findOne({
            email: email.toLowerCase(),
            used: false,
            expiresAt: { $gt: now }
          }).sort({ createdAt: -1 }).lean();
        }
        return doc;
      } else {
        const list = localDb.read<any>('otps');
        let activeList = list
          .filter(o => 
            (o.institutionId === institutionId || institutionId === 'default' || !institutionId) && 
            o.email.toLowerCase() === email.toLowerCase() && 
            !o.used && 
            new Date(o.expiresAt).getTime() > now.getTime()
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (activeList.length === 0) {
          activeList = list
            .filter(o => 
              o.email.toLowerCase() === email.toLowerCase() && 
              !o.used && 
              new Date(o.expiresAt).getTime() > now.getTime()
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return activeList[0] || null;
      }
    },
    incrementAttempts: async (id: string): Promise<any> => {
      if (getStorageMode() === 'atlas') {
        return await OtpModel.findOneAndUpdate({ id }, { $inc: { attempts: 1 } }, { new: true }).lean();
      } else {
        const list = localDb.read<any>('otps');
        const idx = list.findIndex(o => o.id === id);
        if (idx !== -1) {
          list[idx].attempts = (list[idx].attempts || 0) + 1;
          localDb.write('otps', list);
          return list[idx];
        }
        return null;
      }
    },
    markUsed: async (id: string): Promise<any> => {
      if (getStorageMode() === 'atlas') {
        return await OtpModel.findOneAndUpdate({ id }, { $set: { used: true } }, { new: true }).lean();
      } else {
        const list = localDb.read<any>('otps');
        const idx = list.findIndex(o => o.id === id);
        if (idx !== -1) {
          list[idx].used = true;
          localDb.write('otps', list);
          return list[idx];
        }
        return null;
      }
    },
    invalidatePrevious: async (institutionId: string, email: string): Promise<void> => {
      if (getStorageMode() === 'atlas') {
        await OtpModel.updateMany(
          { institutionId, email: email.toLowerCase(), used: false },
          { $set: { used: true } }
        );
      } else {
        const list = localDb.read<any>('otps');
        let changed = false;
        list.forEach(o => {
          if (o.institutionId === institutionId && o.email.toLowerCase() === email.toLowerCase() && !o.used) {
            o.used = true;
            changed = true;
          }
        });
        if (changed) {
          localDb.write('otps', list);
        }
      }
    },
    cleanupExpired: async (): Promise<void> => {
      const now = new Date();
      if (getStorageMode() === 'atlas') {
        await OtpModel.deleteMany({ expiresAt: { $lte: now } });
      } else {
        const list = localDb.read<any>('otps');
        const filtered = list.filter(o => new Date(o.expiresAt).getTime() > now.getTime());
        if (filtered.length !== list.length) {
          localDb.write('otps', filtered);
        }
      }
    }
  },
  announcements: {
    findMany: async (filter: Partial<Announcement> = {}): Promise<Announcement[]> => {
      if (getStorageMode() === 'atlas') {
        return await AnnouncementModel.find(filter).select('-attachmentData').sort({ createdAt: -1 }).lean();
      } else {
        let list = localDb.read<Announcement>('announcements');
        Object.entries(filter).forEach(([k, val]) => {
          list = list.filter(item => {
            if (val === null || val === undefined) {
              return (item as any)[k] === val;
            }
            if (Array.isArray(val)) {
              return Array.isArray((item as any)[k]) && val.every(v => ((item as any)[k] as any[]).includes(v));
            }
            return (item as any)[k] === val;
          });
        });
        return list
          .map((item: any) => {
            const { attachmentData: _omit, ...rest } = item;
            return rest as Announcement;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    },
    findById: async (id: string): Promise<Announcement | null> => {
      if (getStorageMode() === 'atlas') {
        return await AnnouncementModel.findOne({ id }).select('-attachmentData').lean();
      } else {
        const found: any = localDb.read<Announcement>('announcements').find(a => a.id === id);
        if (!found) return null;
        const { attachmentData: _omit, ...rest } = found;
        return rest as Announcement;
      }
    },
    findAttachmentById: async (id: string): Promise<(Announcement & { attachmentData?: string }) | null> => {
      if (getStorageMode() === 'atlas') {
        return await AnnouncementModel.findOne({ id }).lean();
      } else {
        return (localDb.read<Announcement>('announcements').find(a => a.id === id) as any) || null;
      }
    },
    create: async (
      announcementData: Omit<Announcement, 'id' | 'announcementId' | 'createdAt'> & { attachmentData?: string }
    ): Promise<Announcement> => {
      const id = 'ann-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const completeData: Announcement & { attachmentData?: string } = {
        ...announcementData,
        id,
        announcementId: id,
        createdAt: new Date().toISOString()
      };
      if (completeData.attachmentData && (!completeData.attachmentUrl || completeData.attachmentUrl === '__ATTACHMENT_ENDPOINT__')) {
        completeData.attachmentUrl = `/api/announcements/${id}/attachment`;
      }
      if (getStorageMode() === 'atlas') {
        const doc = new AnnouncementModel(completeData);
        await doc.save();
        const obj = doc.toObject();
        delete obj.attachmentData;
        return obj;
      } else {
        const list = localDb.read<Announcement>('announcements');
        list.push(completeData);
        localDb.write('announcements', list);
        const { attachmentData: _omit, ...rest } = completeData;
        return rest;
      }
    },
    update: async (
      id: string,
      updates: Partial<Record<keyof Announcement | 'attachmentData', any>>
    ): Promise<Announcement | null> => {
      const setFields: Record<string, any> = {
        updatedAt: new Date().toISOString()
      };
      const unsetFields: Record<string, 1> = {};
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null) {
          unsetFields[key] = 1;
        } else if (val !== undefined) {
          setFields[key] = val;
        }
      });

      if (getStorageMode() === 'atlas') {
        const mongoUpdate: any = { $set: setFields };
        if (Object.keys(unsetFields).length > 0) {
          mongoUpdate.$unset = unsetFields;
        }
        return await AnnouncementModel.findOneAndUpdate({ id }, mongoUpdate, { new: true })
          .select('-attachmentData')
          .lean();
      } else {
        const list = localDb.read<Announcement>('announcements');
        const idx = list.findIndex(a => a.id === id);
        if (idx !== -1) {
          const updatedItem: any = { ...list[idx], ...setFields };
          Object.keys(unsetFields).forEach(k => {
            delete updatedItem[k];
          });
          list[idx] = updatedItem;
          localDb.write('announcements', list);
          const { attachmentData: _omit, ...rest } = updatedItem;
          return rest;
        }
        return null;
      }
    },
    delete: async (id: string): Promise<boolean> => {
      if (getStorageMode() === 'atlas') {
        const res = await AnnouncementModel.deleteOne({ id });
        return res.deletedCount > 0;
      } else {
        const list = localDb.read<Announcement>('announcements');
        const filtered = list.filter(a => a.id !== id);
        if (filtered.length !== list.length) {
          localDb.write('announcements', filtered);
          return true;
        }
        return false;
      }
    }
  }
};
