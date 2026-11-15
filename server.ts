import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { 
  db, 
  connectToDatabase, 
  isMongoConnected, 
  lastConnectionTime, 
  getDatabaseDiagnostics, 
  DatabaseUnavailableError,
  validateStorageConfiguration 
} from './src/server/db';
import { authenticateToken, generateToken, requireRole, AuthenticatedRequest, validateJwtConfiguration } from './src/server/auth';
import { 
  handleSubmissionNotifications, 
  handleResolutionNotifications, 
  handleReopenNotifications 
} from './src/server/email';
import { HelpComplaintRequest, RequestStatus, Announcement } from './src/types';
import { handleDemoCredentials } from './src/server/demoAuth';
import cookieParser from 'cookie-parser';
import { 
  createHelmetMiddleware, 
  createCorsMiddleware, 
  createRateLimiters, 
  getAuthCookieOptions, 
  getCsrfCookieOptions, 
  csrfTokenProvider, 
  verifyCsrfProtection,
  generateCsrfToken
} from './src/server/security';
import { safeFetchResource } from './src/server/ssrf';
import { logger } from './src/server/logger';
import { 
  livenessHandler, 
  readinessHandler, 
  createRequestTimeout, 
  idempotencyMiddleware, 
  setupGracefulShutdown 
} from './src/server/resilience';
import { validateMagicBytes, getStorageProvider, validateAnnouncementAttachment } from './src/server/storage';

const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.FUNCTION_TARGET
);

export async function createApp(): Promise<express.Express> {
  const app = express();

  // Centralized storage configuration validation before accepting traffic
  const storageConfig = validateStorageConfiguration();
  if (!storageConfig.isValid) {
    console.error('\n=============================================================');
    console.error('[FATAL CONFIGURATION ERROR] Application startup halted:');
    console.error(storageConfig.error);
    console.error('=============================================================\n');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(storageConfig.error);
    }
  }

  // Centralized JWT secret configuration validation before accepting traffic
  const jwtConfig = validateJwtConfiguration();
  if (!jwtConfig.isValid) {
    console.error('\n=============================================================');
    console.error('[FATAL CONFIGURATION ERROR] Application startup halted:');
    console.error(jwtConfig.error);
    console.error('=============================================================\n');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(jwtConfig.error);
    }
  }

  function sendDbAwareError(res: express.Response, error: any, defaultMessage: string, defaultStatus = 500) {
    if (
      error?.statusCode === 503 ||
      error?.isDatabaseUnavailable ||
      error?.name === 'DatabaseUnavailableError' ||
      error?.name === 'MongooseServerSelectionError'
    ) {
      return res.status(503).json({
        error: error.message || 'Database service is temporarily unavailable. Connection to MongoDB Atlas is recovering. Please retry shortly.',
        isDatabaseUnavailable: true,
        retryAfterSeconds: 5
      });
    }
    return res.status(defaultStatus).json({ error: error?.message || defaultMessage });
  }

  // Trust proxy: Cloud Run and reverse-proxy safe topology
  app.set('trust proxy', 1);

  // 1. Helmet security headers & Content Security Policy
  app.use(createHelmetMiddleware());

  // 2. Strict CORS allowlist
  app.use(createCorsMiddleware());

  // 3. Cookie parser for HttpOnly session cookies
  app.use(cookieParser());

  // 4. Body parsers
  app.use(express.json({ limit: '15mb' })); // High limit for Base64 screenshots
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 5. Anti-CSRF token provider
  app.use(csrfTokenProvider);

  // High-availability health & probe endpoints (unthrottled, fast response for Cloud Run)
  app.get('/api/health/liveness', livenessHandler);
  app.get('/api/health/readiness', readinessHandler);

  // Request execution deadline protection (25s timeout)
  app.use(createRequestTimeout(25000));

  // 6. Rate Limiters
  const { 
    apiLimiter, 
    authLimiter, 
    forgotPasswordLimiter, 
    otpLimiter, 
    changePasswordLimiter 
  } = createRateLimiters();

  // Apply general API rate limiter to all API endpoints
  app.use('/api', apiLimiter);

  // Apply CSRF verification to all state-changing API endpoints
  app.use('/api', verifyCsrfProtection);

  // Idempotency middleware for mutating API requests (duplicate submission protection)
  app.use('/api', idempotencyMiddleware);

  // Serverless cold-start connection assurance middleware
  app.use('/api', async (req, _res, next) => {
    if (
      req.path === '/health/liveness' ||
      req.path === '/health/readiness' ||
      req.path === '/csrf-token' ||
      req.path.startsWith('/auth/demo-credentials')
    ) {
      return next();
    }
    try {
      await connectToDatabase(false);
    } catch {
      // Downstream handlers surface 503 DatabaseUnavailableError consistently
    }
    next();
  });

  // Default institution SVG placeholder (served reliably in both local and serverless runtimes)
  const DEFAULT_INSTITUTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
  <circle cx="100" cy="100" r="45" fill="#ffffff" opacity="0.1" />
  <path d="M100 70 L130 90 L130 130 L100 130 Z" fill="#ffffff" opacity="0.9" />
  <path d="M100 70 L70 90 L70 130 L100 130 Z" fill="#ffffff" opacity="0.75" />
  <polygon points="100,55 135,70 100,85 65,70" fill="#facc15" />
  <text x="170" y="105" fill="#ffffff" font-family="system-ui, sans-serif" font-size="24" font-weight="900" letter-spacing="1">CAMPUS</text>
  <text x="170" y="135" fill="#93c5fd" font-family="system-ui, sans-serif" font-size="16" font-weight="700" letter-spacing="4">CONNECT</text>
</svg>`;

  app.get('/uploads/default-institution.svg', (_req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(DEFAULT_INSTITUTION_SVG);
  });

  // Setup local uploads directory only when local filesystem is writable (non-serverless development)
  const UPLOADS_DIR = path.join(process.cwd(), '.data/uploads');
  if (!IS_SERVERLESS && process.env.NODE_ENV !== 'production') {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const defaultSvgPath = path.join(UPLOADS_DIR, 'default-institution.svg');
      if (!fs.existsSync(defaultSvgPath)) {
        fs.writeFileSync(defaultSvgPath, DEFAULT_INSTITUTION_SVG);
      }
    } catch (err) {
      console.warn('Could not initialize local uploads directory:', err);
    }
    app.use('/uploads', express.static(UPLOADS_DIR));
  }

  // Helper to save Base64 Image safely with magic byte verification
  // In serverless/production (e.g. Vercel), persist validated data URL directly in MongoDB to survive ephemeral instances.
  function saveBase64Image(base64DataUrl: string): string {
    if (!base64DataUrl) return '';
    const match = base64DataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
    if (!match) {
      throw new Error('Only PNG, JPG, and WEBP image formats are supported.');
    }
    const base64Content = base64DataUrl.split(',')[1];
    if (!base64Content) {
      throw new Error('Invalid Base64 image payload.');
    }
    const buffer = Buffer.from(base64Content, 'base64');
    const maxAllowedBytes = (IS_SERVERLESS || process.env.NODE_ENV === 'production') ? 2.5 * 1024 * 1024 : 5 * 1024 * 1024;
    if (buffer.length > maxAllowedBytes) {
      throw new Error(`Image size must be less than ${(maxAllowedBytes / (1024 * 1024)).toFixed(1)} MB.`);
    }

    const mimeType = match[1].toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${match[1].toLowerCase()}`;
    const magicValidation = validateMagicBytes(buffer, mimeType);
    if (!magicValidation.isValid) {
      throw new Error(magicValidation.error || 'Corrupted or invalid image header.');
    }

    if (IS_SERVERLESS || process.env.NODE_ENV === 'production') {
      return base64DataUrl;
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const filename = `inst-logo-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;

    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return `/uploads/${filename}`;
  }

  // Helper to resolve relative URL to absolute URL
  function resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  // Scraper utility to automatically fetch logo from website with full SSRF & DNS rebinding protection
  async function fetchLogoFromWebsite(websiteUrl: string): Promise<string | null> {
    if (!websiteUrl) return null;
    try {
      const result = await safeFetchResource(websiteUrl, {
        maxRedirects: 3,
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 3500
      });
      if (!result || !result.text) return null;

      const html = result.text;
      const url = result.finalUrl;

      // 1. Check og:image
      const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogMatch && ogMatch[1]) {
        return resolveUrl(url, ogMatch[1]);
      }

      // 2. Check logo image (img tag with "logo" in class, id, or alt)
      const logoRegex = /<img[^>]*src=["']([^"']+)["'][^>]*(?:id|class|alt|title)=["']([^"']*logo[^"']*)["']/i;
      const logoMatch = html.match(logoRegex) || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:id|class|alt|title)=["']logo["']/i) || html.match(/<img[^>]*logo[^>]*src=["']([^"']+)["']/i);
      if (logoMatch && logoMatch[1]) {
        return resolveUrl(url, logoMatch[1]);
      }

      // 3. Check favicon
      const favRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i;
      const favMatch = html.match(favRegex);
      if (favMatch && favMatch[1]) {
        return resolveUrl(url, favMatch[1]);
      }

      // 4. Fallback to any image
      const imgMatch = html.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        return resolveUrl(url, imgMatch[1]);
      }

      return null;
    } catch (err) {
      console.warn('Could not automatically scrape logo from website:', websiteUrl, err);
      return null;
    }
  }

  /**
   * ==========================================
   * AUTHENTICATION API ROUTES
   * ==========================================
   */

  // Fetch all registered institutions (excludes test institutions by default)
  app.get('/api/institutions', async (req, res) => {
    try {
      const includeTest = req.query.includeTest === 'true';
      let list = await db.institutions.findMany();
      if (!includeTest) {
        list = list.filter((inst: any) => !inst.isTest && inst.status !== 'test');
      }
      res.json(list);
    } catch (error) {
      sendDbAwareError(res, error, 'Failed to fetch registered institutions.');
    }
  });

  // Fetch details for a specific institution (any authenticated user can view)
  app.get('/api/institutions/:id', authenticateToken, async (req, res) => {
    try {
      const inst = await db.institutions.findById(req.params.id);
      if (!inst) {
        return res.status(404).json({ error: 'Institution not found.' });
      }
      res.json(inst);
    } catch (error) {
      sendDbAwareError(res, error, 'Failed to fetch institution profile.');
    }
  });

  // Update institution profile (Super Admin Only)
  app.put('/api/institutions/:id', authenticateToken, requireRole(['superadmin']), async (req, res: any) => {
    try {
      const targetId = req.params.id;
      const requestingUser: any = (req as any).user;
      if (requestingUser.institutionId !== targetId) {
        return res.status(403).json({ error: 'Unauthorized: You can only edit your own institution profile.' });
      }

      const {
        name,
        website,
        officialEmail,
        contactNumber,
        address,
        city,
        state,
        country,
        postalCode,
        category,
        description,
        logo,
        socialTwitter,
        socialLinkedin,
        socialFacebook,
        adminName,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Institution Name is required.' });
      }

      // Update admin display name if provided
      let updatedUserPayload = { ...requestingUser };
      if (updatedUserPayload) {
        delete (updatedUserPayload as any).iat;
        delete (updatedUserPayload as any).exp;
      }
      let newToken = null;
      if (adminName && requestingUser && requestingUser.id) {
        await db.staff.update(requestingUser.id, { name: adminName });
        updatedUserPayload.name = adminName;
        newToken = generateToken(updatedUserPayload);
      }

      // Process base64 file upload if provided
      let logoUrl = logo;
      if (logo && logo.startsWith('data:image/')) {
        try {
          logoUrl = saveBase64Image(logo);
        } catch (err: any) {
          return res.status(400).json({ error: err.message || 'Image processing failed.' });
        }
      }

      // Automatically fetch logo from website if empty/cleared
      if (!logoUrl) {
        if (website) {
          const scraped = await fetchLogoFromWebsite(website);
          logoUrl = scraped || '/uploads/default-institution.svg';
        } else {
          logoUrl = '/uploads/default-institution.svg';
        }
      }

      const updated = await db.institutions.update(targetId, {
        name,
        website: website || '',
        officialEmail: officialEmail || '',
        contactNumber: contactNumber || '',
        address: address || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postalCode: postalCode || '',
        category: category || '',
        description: description || '',
        logo: logoUrl,
        socialTwitter: socialTwitter || '',
        socialLinkedin: socialLinkedin || '',
        socialFacebook: socialFacebook || '',
      });

      if (!updated) {
        return res.status(404).json({ error: 'Institution profile not found to update.' });
      }

      res.json({
        success: true,
        message: 'Institution profile updated successfully.',
        institution: updated,
        user: updatedUserPayload,
        token: newToken,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update institution profile.' });
    }
  });

  // Delete / Remove Institution (Super Admin Only)
  app.delete('/api/institutions/:id', authenticateToken, requireRole(['superadmin']), async (req, res: any) => {
    try {
      const targetId = req.params.id;
      const requestingUser: any = (req as any).user;
      if (requestingUser.institutionId !== targetId) {
        return res.status(403).json({ error: 'Unauthorized: You can only delete your own institution.' });
      }

      await db.institutions.delete(targetId);

      res.json({
        success: true,
        message: 'Institution and all associated data have been permanently removed.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete institution.' });
    }
  });

  // Register a new educational institution + create admin
  app.post('/api/institutions/register', authLimiter, async (req, res: any) => {
    try {
      const {
        name,
        type,
        category,
        address,
        city,
        state,
        country,
        postalCode,
        website,
        logo,
        officialEmail,
        contactNumber,
        description,
        adminName,
        adminEmail,
        adminPassword
      } = req.body;

      if (!name || !type || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'Please submit all required registration fields.' });
      }

      // Check if institution already registered
      const allInsts = await db.institutions.findMany();
      if (allInsts.some(inst => inst.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: 'An institution with this name is already registered.' });
      }

      // Check if admin email already exists in staff
      const existingStaff = await db.staff.findByEmail(adminEmail);
      if (existingStaff) {
        return res.status(400).json({ error: 'Admin email already registered in staff records.' });
      }

      // Process uploaded logo or fetch from website automatically
      let resolvedLogo = '';
      if (logo && logo.startsWith('data:image/')) {
        try {
          resolvedLogo = saveBase64Image(logo);
        } catch (err: any) {
          return res.status(400).json({ error: err.message || 'Failed to process uploaded image.' });
        }
      } else if (website) {
        const scraped = await fetchLogoFromWebsite(website);
        resolvedLogo = scraped || '/uploads/default-institution.svg';
      } else {
        resolvedLogo = '/uploads/default-institution.svg';
      }

      // Create Institution with rich fields
      const inst = await db.institutions.create({
        name,
        type,
        category: category || '',
        address: address || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postalCode: postalCode || '',
        website: website || '',
        logo: resolvedLogo,
        officialEmail: officialEmail || adminEmail,
        contactNumber: contactNumber || '',
        description: description || '',
        isTest: Boolean(req.body.isTest),
        status: req.body.status || (req.body.isTest ? 'test' : 'active'),
      });

      // Create Admin account for that institution
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
      
      const newAdmin = await db.staff.create({
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        password: hashedAdminPassword,
        role: 'superadmin',
        departmentKey: 'administration',
        disabled: false,
        institutionId: inst.id
      });

      // Automatically issue token
      const token = generateToken({
        id: newAdmin.id,
        role: 'superadmin',
        name: adminName,
        email: adminEmail,
        departmentKey: 'administration',
        institutionId: inst.id,
      });

      res.cookie('token', token, getAuthCookieOptions());

      res.status(201).json({
        success: true,
        message: 'Institution and Administrator registered successfully.',
        token,
        user: {
          id: newAdmin.id,
          name: adminName,
          email: adminEmail,
          role: 'superadmin',
          departmentKey: 'administration',
          institutionId: inst.id,
        }
      });
    } catch (error) {
      console.error('Institution registration error:', error);
      sendDbAwareError(res, error, 'Failed to register institution and administrator.');
    }
  });

  // Student registration
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { name, enrollmentNumber, email, contactNumber, password, institutionId } = req.body;

      if (!name || !enrollmentNumber || !email || !contactNumber || !password || !institutionId) {
        return res.status(400).json({ error: 'Please submit all required registration fields.' });
      }

      // Check institution validity and resolve target institution
      let targetInstitutionId = institutionId;
      if (!targetInstitutionId || targetInstitutionId === 'default') {
        const allInstitutions = await db.institutions.findMany();
        if (allInstitutions.length > 0) {
          targetInstitutionId = allInstitutions[0].id;
        } else {
          targetInstitutionId = 'default';
        }
      } else {
        const instExists = await db.institutions.findById(targetInstitutionId);
        if (!instExists) {
          return res.status(400).json({ error: 'The selected institution is invalid.' });
        }
      }

      const normalizedEnrollment = enrollmentNumber.trim().toUpperCase();
      const normalizedEmail = email.trim().toLowerCase();

      // Check existing enrollment
      const existingEnrollment = await db.students.findByEnrollment(normalizedEnrollment, targetInstitutionId);
      if (existingEnrollment) {
        return res.status(400).json({ error: 'Enrollment Number already in use.' });
      }

      // Check existing email
      const existingEmail = await db.students.findByEmail(normalizedEmail, targetInstitutionId);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email Address already registered.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const student = await db.students.create({
        name: name.trim(),
        enrollmentNumber: normalizedEnrollment,
        email: normalizedEmail,
        contactNumber: contactNumber.trim(),
        password: hashedPassword,
        institutionId: targetInstitutionId,
      });

      // Issue JWT
      const token = generateToken({
        id: student.id,
        role: 'student',
        name: student.name,
        email: student.email,
        enrollmentNumber: student.enrollmentNumber,
        institutionId: student.institutionId || 'default',
      });

      res.cookie('token', token, getAuthCookieOptions());

      res.status(201).json({
        token,
        user: {
          id: student.id,
          name: student.name,
          email: student.email,
          enrollmentNumber: student.enrollmentNumber,
          contactNumber: student.contactNumber,
          role: 'student',
          institutionId: student.institutionId || 'default',
        }
      });
    } catch (error: any) {
      console.error('Registration processing error:', error);
      sendDbAwareError(res, error, 'Failed to process student registration.');
    }
  });

  // Demo credentials endpoint - strictly disabled in production (HTTP 404).
  // In development, returns only synthetic non-production demonstration data without touching the database.
  app.get('/api/auth/demo-credentials', (req, res) => {
    return handleDemoCredentials(req, res);
  });
  app.get('/api/auth/demo-credentials/:institutionId', (req, res) => {
    return handleDemoCredentials(req, res);
  });

  // Anti-CSRF Token endpoint
  app.get('/api/csrf-token', (req, res) => {
    let token = req.cookies?.['XSRF-TOKEN'];
    if (!token) {
      token = generateCsrfToken();
      res.cookie('XSRF-TOKEN', token, getCsrfCookieOptions());
    }
    return res.json({ csrfToken: token });
  });

  // Logout endpoint to clear HttpOnly authentication cookie
  app.post('/api/auth/logout', (req, res) => {
    const cookieOpts = getAuthCookieOptions();
    res.clearCookie('token', {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
    });
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  // Unified login for Student, Department/Staff, and Superadmin
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { username, password, institutionId, role } = req.body;

      // 1. Validate required fields
      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Please enter your email or enrollment ID.' });
      }
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Please enter your password.' });
      }

      // 2. Validate institution if provided
      let targetInstitutionId = institutionId;
      if (!targetInstitutionId || targetInstitutionId === 'default') {
        const allInstitutions = await db.institutions.findMany();
        if (allInstitutions.length > 0) {
          targetInstitutionId = allInstitutions[0].id;
        } else {
          targetInstitutionId = 'default';
        }
      } else {
        const instExists = await db.institutions.findById(targetInstitutionId);
        if (!instExists) {
          return res.status(400).json({ error: 'The selected institution is invalid.' });
        }
      }

      // 3. Classify and normalize the identifier
      const rawInput = username.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput);
      const normalizedEmail = rawInput.toLowerCase();
      const normalizedEnrollment = rawInput.toUpperCase();
      const normalizedUsername = rawInput.toLowerCase();

      // 4. Role normalization & scoping
      const requestedRole = (role || 'student').toLowerCase();
      let matchedUser: any = null;
      let userRole: 'student' | 'staff' | 'superadmin' = 'student';

      if (requestedRole === 'student') {
        userRole = 'student';
        if (isEmail) {
          matchedUser = await db.students.findByEmail(normalizedEmail, targetInstitutionId);
        } else {
          matchedUser = await db.students.findByEnrollment(normalizedEnrollment, targetInstitutionId);
        }
      } else if (requestedRole === 'department' || requestedRole === 'staff') {
        userRole = 'staff';
        // 1. Primary lookup: actual staff member account from db.staff
        let staffAccount: any = null;
        if (isEmail) {
          staffAccount = await db.staff.findByEmail(normalizedEmail, targetInstitutionId);
        } else {
          staffAccount = await db.staff.findByUsername(normalizedUsername, targetInstitutionId);
        }

        if (staffAccount && staffAccount.role === 'staff') {
          matchedUser = staffAccount;
        } else {
          // 2. Secondary fallback: department-level shared credentials from db.departments
          let dept: any = null;
          if (isEmail) {
            dept = await db.departments.findByEmail(normalizedEmail, targetInstitutionId);
          } else {
            dept = await db.departments.findByUsername(normalizedUsername, targetInstitutionId) ||
                   await db.departments.findByKey(normalizedUsername, targetInstitutionId);
          }
          if (dept) {
            matchedUser = {
              id: dept.id,
              name: dept.name,
              email: dept.officialEmail,
              password: dept.password,
              departmentKey: dept.key,
              role: 'staff',
              disabled: dept.status === 'inactive',
              institutionId: dept.institutionId || targetInstitutionId,
              failedLoginAttempts: 0,
              username: dept.username,
            };
          }
        }
      } else if (requestedRole === 'admin' || requestedRole === 'superadmin') {
        userRole = 'superadmin';
        let staffMember: any = null;
        if (isEmail) {
          staffMember = await db.staff.findByEmail(normalizedEmail, targetInstitutionId);
        } else {
          staffMember = await db.staff.findByUsername(normalizedUsername, targetInstitutionId);
        }
        if (staffMember && staffMember.role === 'superadmin') {
          matchedUser = staffMember;
        }
      } else {
        return res.status(401).json({
          error: 'Invalid email/enrollment ID or password. Please check your credentials and try again.'
        });
      }

      // 5. Account existence verification
      if (!matchedUser) {
        return res.status(401).json({
          error: 'Invalid email/enrollment ID or password. Please check your credentials and try again.'
        });
      }

      // Explicit institution match check (defense-in-depth)
      const userInst = matchedUser.institutionId || 'default';
      if (userInst !== targetInstitutionId && targetInstitutionId !== 'default' && userInst !== 'default') {
        return res.status(401).json({
          error: 'Invalid email/enrollment ID or password. Please check your credentials and try again.'
        });
      }

      // 6. Check account status (disabled)
      if (matchedUser.disabled === true || matchedUser.status === 'inactive') {
        return res.status(403).json({ error: 'This account is disabled. Please contact the administrator.' });
      }

      // 7. Check account lockout (5 or more failed attempts)
      if (userRole !== 'student' && (matchedUser.failedLoginAttempts || 0) >= 5) {
        return res.status(403).json({
          error: 'This account has been locked due to consecutive failed login attempts. Please contact your Institution Admin or reset your password using OTP.'
        });
      }

      // 8. Password verification (Pure bcrypt compare - no plain-text fallback)
      let isMatch = false;
      if (matchedUser.password && typeof matchedUser.password === 'string' && matchedUser.password.length > 0) {
        try {
          isMatch = await bcrypt.compare(password, matchedUser.password);
        } catch (bcryptErr) {
          console.warn('[AUTH LOGIN] Bcrypt comparison error:', bcryptErr);
          isMatch = false;
        }
      }

      if (!isMatch) {
        if (userRole === 'superadmin') {
          const currentFailures = (matchedUser.failedLoginAttempts || 0) + 1;
          await db.staff.update(matchedUser.id, { failedLoginAttempts: currentFailures });
          console.log(`[AUTH LOGIN] Failed login for superadmin ${matchedUser.id}. Total failures: ${currentFailures}`);
          if (currentFailures >= 5) {
            return res.status(403).json({
              error: 'This account has been locked due to consecutive failed login attempts. Please contact your Institution Admin or reset your password using OTP.'
            });
          }
        }
        return res.status(401).json({
          error: 'Invalid email/enrollment ID or password. Please check your credentials and try again.'
        });
      }

      // 9. On successful authentication, reset lockout counters & log metadata
      if (userRole === 'superadmin') {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const device = req.headers['user-agent'] || 'Unknown Device';
        await db.staff.update(matchedUser.id, {
          failedLoginAttempts: 0,
          lastLogin: new Date().toISOString(),
          lastLoginIp: String(ip),
          lastLoginDevice: String(device)
        });
      }

      // 10. Issue JWT token
      const tokenPayload: any = {
        id: matchedUser.id,
        role: userRole,
        name: matchedUser.name,
        email: matchedUser.email,
        institutionId: matchedUser.institutionId || targetInstitutionId,
      };

      if (userRole === 'student') {
        tokenPayload.enrollmentNumber = matchedUser.enrollmentNumber;
      } else {
        tokenPayload.departmentKey = matchedUser.departmentKey;
      }

      const token = generateToken(tokenPayload);

      res.cookie('token', token, getAuthCookieOptions());

      return res.json({
        token,
        mustChangePassword: !!(userRole !== 'student' && matchedUser.forcePasswordChange),
        user: {
          id: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          username: matchedUser.username || null,
          role: userRole,
          enrollmentNumber: matchedUser.enrollmentNumber || null,
          contactNumber: matchedUser.contactNumber || null,
          departmentKey: matchedUser.departmentKey || null,
          institutionId: matchedUser.institutionId || targetInstitutionId,
        }
      });
    } catch (error: any) {
      console.error('[AUTH LOGIN] Internal server error:', error);
      return sendDbAwareError(res, error, 'Authentication service temporarily unavailable. Please try again.');
    }
  });

  // Simple in-memory rate limiter for OTP requests
  const lastOtpRequest = new Map<string, number>();

  app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
      const { email, institutionId } = req.body;
      console.log(`[FORGOT PASSWORD] Step 1: Starting lookup for email: '${email}', institutionId: '${institutionId}'`);

      if (!email || !institutionId) {
        console.warn(`[FORGOT PASSWORD] Validation: Missing email or institutionId.`);
        return res.status(400).json({ error: 'Email address and Institution are required.' });
      }

      const inputEmail = email.trim().toLowerCase();

      // Clean up expired OTPs from the database
      await db.otps.cleanupExpired();

      // Seek user globally first to provide detailed mismatch/existence checks
      console.log(`[FORGOT PASSWORD] Step 2: Querying global database for email: '${inputEmail}'`);
      const globalStudent = await db.students.findByEmail(inputEmail);
      const globalStaff = await db.staff.findByEmail(inputEmail);

      if (!globalStudent && !globalStaff) {
        console.warn(`[FORGOT PASSWORD] No account found matching email '${inputEmail}'`);
        return res.status(404).json({ error: 'Account not found. Please verify the email address or register with your institution.' });
      }

      const matchedUser = globalStudent || globalStaff;
      const userType = globalStudent ? 'student' : (globalStaff.role === 'superadmin' ? 'superadmin' : 'staff');
      console.log(`[FORGOT PASSWORD] Step 3: Account found globally. ID: ${matchedUser.id}, Type/Role: ${userType}, Stored InstitutionId: '${matchedUser.institutionId || 'default'}'`);

      // Check for institution mismatch
      const userInstId = matchedUser.institutionId || 'default';
      const selectedInstId = institutionId || 'default';
      if (userInstId !== selectedInstId) {
        const mismatchError = `Institution mismatch. Account belongs to '${userInstId}' but selected '${selectedInstId}'.`;
        console.warn(`[FORGOT PASSWORD] Institution mismatch: ${mismatchError}`);
        return res.status(400).json({ error: 'Institution mismatch' });
      }

      // Department officers (role: 'staff') cannot self-reset
      if (userType === 'staff') {
        const forbiddenError = 'Department officers cannot reset their passwords here. Please contact your Institution Admin.';
        console.warn(`[FORGOT PASSWORD] Staff restriction: ${forbiddenError}`);
        return res.status(400).json({ error: forbiddenError });
      }

      console.log(`[FORGOT PASSWORD] Step 4: Validation successful. Validating rate limits and active OTPs.`);

      // Check 60-second rate limit countdown
      const now = Date.now();
      const lastTime = lastOtpRequest.get(`${institutionId}:${inputEmail}`);
      if (lastTime && now - lastTime < 60 * 1000) {
        const secondsRemaining = Math.ceil((60 * 1000 - (now - lastTime)) / 1000);
        const rateLimitError = `Please wait ${secondsRemaining} seconds before requesting another OTP.`;
        console.warn(`[FORGOT PASSWORD] Rate limit: ${rateLimitError}`);
        return res.status(429).json({ error: rateLimitError });
      }

      // Check resend limit from existing active OTP
      const activeOtp = await db.otps.findActive(institutionId, inputEmail);
      let resendCount = 0;
      if (activeOtp) {
        if (activeOtp.resendCount >= 3) {
          const limitError = 'Maximum OTP resend requests (3) exceeded. Please try again after 10 minutes.';
          console.warn(`[FORGOT PASSWORD] Resend limit reached: ${limitError}`);
          return res.status(429).json({ error: limitError });
        }
        resendCount = activeOtp.resendCount + 1;
      }

      // Generate cryptographically secure random 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();

      // Resend Configuration
      const resendApiKey = process.env.RESEND_API_KEY;

      let emailSentSuccessfully = false;
      let emailErrorDetails = '';
      let isRecipientRestricted = false;

      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);

          const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your CampusConnect Security Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 500px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #4f46e5;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      margin: 0;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px;
      color: #1e293b;
    }
    .content h2 {
      font-size: 18px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px 0;
      color: #475569;
    }
    .otp-container {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
      letter-spacing: 6px;
      font-size: 32px;
      font-weight: 800;
      color: #4f46e5;
    }
    .warning {
      font-size: 12px;
      color: #ef4444;
      background-color: #fef2f2;
      border: 1px solid #fee2e2;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CampusConnect</h1>
    </div>
    <div class="content">
      <h2>Hello ${matchedUser.name},</h2>
      <p>We received a request to reset your password. Use the secure 6-digit verification code below to proceed:</p>
      
      <div class="otp-container">${otp}</div>

      <div class="warning">
        <strong>Important Security Notice:</strong> This code is time-sensitive and will expire in 10 minutes. For your security, do not share this code with anyone. CampusConnect staff will never ask for your security code.
      </div>

      <p style="margin: 0; font-size: 13px;">If you did not request a password reset, please secure your account immediately or ignore this email safely.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} CampusConnect. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `;

          let sendResult = await resend.emails.send({
            from: 'CampusConnect Security <onboarding@resend.dev>',
            to: matchedUser.email,
            subject: 'Your CampusConnect Security Verification Code',
            text: `Hello ${matchedUser.name},\n\nYour CampusConnect security verification code is: ${otp}\n\nThis code is valid for 10 minutes. If you did not request this code, please secure your account.\n\nCampusConnect Security`,
            html: htmlContent,
          });

          if (sendResult.error) {
            const errObj = sendResult.error as any;
            const errMsg = errObj.message || JSON.stringify(sendResult.error);
            if (errMsg.includes('only send testing emails to your own email address') || errObj.statusCode === 403) {
              isRecipientRestricted = true;
              console.log(`[Resend Testing Mode] Recipient '${matchedUser.email}' is restricted in Resend testing mode. Rerouting OTP delivery to verified owner (2007anshdhankar@gmail.com)...`);
              
              // Deliver to verified owner address so user receives code in real inbox
              const fallbackSend = await resend.emails.send({
                from: 'CampusConnect Security <onboarding@resend.dev>',
                to: '2007anshdhankar@gmail.com',
                subject: `Your CampusConnect Security Code (Account: ${matchedUser.email})`,
                text: `Hello ${matchedUser.name},\n\nYour security verification code for ${matchedUser.email} is: ${otp}\n\n(Note: Delivered to 2007anshdhankar@gmail.com because Resend is in testing mode).\n\nValid for 10 minutes.`,
                html: htmlContent.replace(
                  `<h2>Hello ${matchedUser.name},</h2>`,
                  `<h2>Hello ${matchedUser.name},</h2><div style="background-color:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:10px;border-radius:6px;font-size:12px;margin-bottom:16px;"><strong>Resend Testing Mode:</strong> This verification code was generated for <strong>${matchedUser.email}</strong> and delivered to your verified owner email.</div>`
                )
              });

              if (!fallbackSend.error) {
                emailSentSuccessfully = true;
                console.log(`[Resend Testing Mode] Successfully dispatched OTP email to verified owner: 2007anshdhankar@gmail.com`);
              } else {
                console.warn(`[Resend Testing Mode] Fallback send error:`, fallbackSend.error);
                emailErrorDetails = JSON.stringify(fallbackSend.error);
              }
            } else {
              throw new Error(errMsg);
            }
          } else {
            emailSentSuccessfully = true;
            console.log(`[Resend] Secure OTP email successfully sent to registered recipient: ${matchedUser.email}`);
          }
        } catch (err: any) {
          console.error('[Resend Error] Failed to send OTP email via Resend:', err.message || err);
          emailErrorDetails = err.message || String(err);
        }
      } else {
        emailErrorDetails = 'Email delivery service is not configured (missing RESEND_API_KEY).';
      }

      // If email sent successfully OR testing mode was detected, persist OTP challenge securely
      if (emailSentSuccessfully || isRecipientRestricted) {
        // Invalidate all previous OTPs for this user & institution
        await db.otps.invalidatePrevious(institutionId, inputEmail);

        // Hash OTP securely using bcrypt (10 rounds)
        const otpHash = await bcrypt.hash(otp, 10);

        // OTP expires in 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Store hashed OTP in database
        await db.otps.create({
          institutionId,
          email: inputEmail,
          otpHash,
          expiresAt,
          resendCount
        });

        // Set rate limit cooldown timestamp
        lastOtpRequest.set(`${institutionId}:${inputEmail}`, now);

        const successMessage = isRecipientRestricted
          ? `Verification code generated. Resend is in testing mode: Code delivered to verified owner inbox (2007anshdhankar@gmail.com) for account ${matchedUser.email}.`
          : 'A 6-digit verification code has been dispatched to your registered email address.';

        return res.json({
          success: true,
          message: successMessage,
          isSandbox: isRecipientRestricted
        });
      } else {
        return res.status(422).json({
          error: `Failed to deliver OTP verification email: ${emailErrorDetails}`,
          code: 'EMAIL_DELIVERY_FAILED'
        });
      }
    } catch (error: any) {
      console.error('Forgot password endpoint error:', error);
      res.status(500).json({ error: `System error processing your password reset request: ${error.message || String(error)}` });
    }
  });

  app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
    try {
      const { email, institutionId, otp } = req.body;
      const cleanOtp = String(otp || '').trim();

      console.log(`[OTP VERIFICATION AUDIT] === Incoming OTP Verification Request ===`);
      console.log(`[OTP VERIFICATION AUDIT] Raw body parameters:`, {
        email,
        institutionId,
        rawOtpType: typeof otp,
        rawOtpValue: JSON.stringify(otp),
        cleanOtpLength: cleanOtp.length
      });

      if (!email || !institutionId || !cleanOtp) {
        console.warn(`[OTP VERIFICATION AUDIT] Rejection: Missing required fields (email=${!!email}, institutionId=${!!institutionId}, otp=${!!cleanOtp})`);
        return res.status(400).json({ error: 'Email, Institution, and OTP code are required.' });
      }

      const inputEmail = email.trim().toLowerCase();

      // Find active OTP (sorted newest first)
      const activeOtp = await db.otps.findActive(institutionId, inputEmail);
      
      console.log(`[OTP VERIFICATION AUDIT] Database Challenge Lookup for institutionId='${institutionId}', email='${inputEmail}':`,
        activeOtp ? {
          challengeId: activeOtp.id,
          email: activeOtp.email,
          institutionId: activeOtp.institutionId,
          createdAt: activeOtp.createdAt,
          expiresAt: activeOtp.expiresAt,
          isExpired: new Date(activeOtp.expiresAt).getTime() <= Date.now(),
          attempts: activeOtp.attempts,
          used: activeOtp.used,
          resendCount: activeOtp.resendCount,
          hasOtpHash: !!activeOtp.otpHash,
          otpHashLength: activeOtp.otpHash ? activeOtp.otpHash.length : 0,
          otpHashPrefix: activeOtp.otpHash ? activeOtp.otpHash.substring(0, 10) + '...' : 'none'
        } : 'NO_ACTIVE_CHALLENGE_FOUND'
      );

      if (!activeOtp) {
        console.warn(`[OTP VERIFICATION AUDIT] Rejection: No active, unexpired challenge found for email '${inputEmail}' and institution '${institutionId}'`);
        return res.status(400).json({ error: 'No active OTP found or OTP has expired. Please request a new code.' });
      }

      // Check attempt limit
      if (activeOtp.attempts >= 5) {
        await db.otps.markUsed(activeOtp.id);
        console.warn(`[OTP VERIFICATION AUDIT] Rejection: Challenge ${activeOtp.id} locked due to exceeding 5 attempts.`);
        return res.status(429).json({ 
          error: 'This verification code has been locked due to exceeding the limit of 5 attempts. Please request a new code.' 
        });
      }

      // Compare entered OTP
      console.log(`[OTP VERIFICATION AUDIT] Comparing cleanOtp='${cleanOtp}' against challenge otpHash (prefix='${activeOtp.otpHash ? activeOtp.otpHash.substring(0, 10) : ''}...')`);
      const isMatch = await bcrypt.compare(cleanOtp, activeOtp.otpHash);
      console.log(`[OTP VERIFICATION AUDIT] bcrypt.compare result: ${isMatch ? 'MATCH_SUCCESS (Code Valid)' : 'MISMATCH_FAILED (Code Invalid)'}`);

      if (isMatch) {
        // Mark OTP as used (invalidate it)
        await db.otps.markUsed(activeOtp.id);
        console.log(`[OTP VERIFICATION AUDIT] Challenge marked used. Reset token generation initiated for ${inputEmail}`);

        // Generate a temporary secure reset token for resetting the password
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Save this token to the matched Student or Staff
        let matchedUser = await db.students.findByEmail(inputEmail, institutionId);
        let userType: 'student' | 'staff' = 'student';

        if (!matchedUser) {
          matchedUser = await db.staff.findByEmail(inputEmail, institutionId);
          userType = 'staff';
        }

        if (matchedUser) {
          if (userType === 'student') {
            await db.students.update(matchedUser.id, {
              resetPasswordToken: resetToken,
              resetPasswordExpires: resetExpires
            });
          } else {
            await db.staff.update(matchedUser.id, {
              resetPasswordToken: resetToken,
              resetPasswordExpires: resetExpires
            });
          }
          console.log(`[OTP VERIFICATION AUDIT] Stored resetToken on ${userType} ID=${matchedUser.id}`);
        } else {
          console.warn(`[OTP VERIFICATION AUDIT] Warning: No matched student or staff found to attach resetToken for ${inputEmail}`);
        }

        return res.json({
          success: true,
          message: 'OTP verified successfully.',
          resetToken
        });
      } else {
        // Increment verification attempts
        const updatedOtp = await db.otps.incrementAttempts(activeOtp.id);
        const attempts = updatedOtp ? updatedOtp.attempts : (activeOtp.attempts + 1);
        const attemptsLeft = 5 - attempts;
        console.warn(`[OTP VERIFICATION AUDIT] Verification attempt failed. Remaining attempts: ${attemptsLeft}`);
        if (attemptsLeft <= 0) {
          await db.otps.markUsed(activeOtp.id);
          return res.status(429).json({
            error: 'Incorrect OTP. This verification code has now been locked due to exceeding 5 attempts.'
          });
        }

        return res.status(400).json({
          error: `Incorrect OTP. You have ${attemptsLeft} attempts remaining.`
        });
      }
    } catch (error: any) {
      console.error('Verify OTP endpoint error:', error);
      res.status(500).json({ error: `System error during verification: ${error.message || String(error)}` });
    }
  });

  app.post('/api/auth/validate-reset-token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Reset token is required.' });
      }

      let matchedUser = await db.students.findByResetToken(token);
      if (!matchedUser) {
        matchedUser = await db.staff.findByResetToken(token);
      }

      if (!matchedUser) {
        return res.status(400).json({ error: 'This security reset token is invalid.' });
      }

      // Check expiry
      if (!matchedUser.resetPasswordExpires || new Date(matchedUser.resetPasswordExpires).getTime() < Date.now()) {
        return res.status(400).json({ error: 'This secure reset link has expired. Please request a new one.' });
      }

      res.json({
        success: true,
        email: matchedUser.email,
        name: matchedUser.name
      });
    } catch (error: any) {
      console.error('Validate token endpoint error:', error);
      res.status(500).json({ error: `System error validating the security token: ${error.message || String(error)}` });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ error: 'Token, Password, and Confirmation are all required.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      // Security Requirements validation:
      // Minimum 6 characters, uppercase, lowercase, number, special character
      const minLength = 6;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);

      if (password.length < minLength) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!hasUppercase) {
        return res.status(400).json({ error: 'Password must contain at least one uppercase letter (A-Z).' });
      }
      if (!hasLowercase) {
        return res.status(400).json({ error: 'Password must contain at least one lowercase letter (a-z).' });
      }
      if (!hasNumber) {
        return res.status(400).json({ error: 'Password must contain at least one digit (0-9).' });
      }
      if (!hasSpecial) {
        return res.status(400).json({ error: 'Password must contain at least one special character (e.g. !, @, #, $, etc.).' });
      }

      let matchedUser = await db.students.findByResetToken(token);
      let userType: 'student' | 'staff' = 'student';

      if (!matchedUser) {
        matchedUser = await db.staff.findByResetToken(token);
        userType = 'staff';
      }

      if (!matchedUser) {
        return res.status(400).json({ error: 'This secure reset link is invalid or has already been used.' });
      }

      // Check expiry
      if (!matchedUser.resetPasswordExpires || new Date(matchedUser.resetPasswordExpires).getTime() < Date.now()) {
        return res.status(400).json({ error: 'This secure reset link has expired. Please request a new one.' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Save password and clear reset token fields
      if (userType === 'student') {
        await db.students.update(matchedUser.id, {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null
        });
      } else {
        await db.staff.update(matchedUser.id, {
          password: hashedPassword,
          failedLoginAttempts: 0,
          resetPasswordToken: null,
          resetPasswordExpires: null
        });
      }

      res.json({
        success: true,
        message: 'Your password has been successfully updated. You may now log in.'
      });
    } catch (error: any) {
      console.error('Reset password endpoint error:', error);
      res.status(500).json({ error: `System error resetting your password: ${error.message || String(error)}` });
    }
  });

  // Authenticated Change Password for logged-in Student, Staff, and Superadmin
  app.post('/api/auth/change-password', changePasswordLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Current password, new password, and confirm password are required.' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New password and confirmation do not match.' });
      }

      // Security Requirements validation matching existing system policy:
      // Minimum 6 characters, uppercase, lowercase, number, special character
      const minLength = 6;
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

      if (newPassword.length < minLength) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!hasUppercase) {
        return res.status(400).json({ error: 'Password must contain at least one uppercase letter (A-Z).' });
      }
      if (!hasLowercase) {
        return res.status(400).json({ error: 'Password must contain at least one lowercase letter (a-z).' });
      }
      if (!hasNumber) {
        return res.status(400).json({ error: 'Password must contain at least one digit (0-9).' });
      }
      if (!hasSpecial) {
        return res.status(400).json({ error: 'Password must contain at least one special character (e.g. !, @, #, $, etc.).' });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      let matchedUser: any = null;

      if (userRole === 'student') {
        matchedUser = await db.students.findById(userId);
      } else if (userRole === 'staff' || userRole === 'superadmin') {
        matchedUser = await db.staff.findById(userId);
        if (!matchedUser && userRole === 'staff') {
          // Fallback to department record if authenticated via department shared account
          matchedUser = await db.departments.findByKey(userId, req.user.institutionId) ||
                        await db.departments.findByUsername(userId, req.user.institutionId);
        }
      }

      if (!matchedUser) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      // Verify current password with bcrypt
      let isCurrentMatch = false;
      if (matchedUser.password && typeof matchedUser.password === 'string' && matchedUser.password.length > 0) {
        try {
          isCurrentMatch = await bcrypt.compare(currentPassword, matchedUser.password);
        } catch (bcryptErr) {
          console.warn('[AUTH CHANGE PASSWORD] Bcrypt comparison error:', bcryptErr);
          isCurrentMatch = false;
        }
      }

      if (!isCurrentMatch) {
        return res.status(400).json({ error: 'Incorrect current password. Please verify and try again.' });
      }

      // Prevent reusing identical password
      const isIdentical = await bcrypt.compare(newPassword, matchedUser.password);
      if (isIdentical) {
        return res.status(400).json({ error: 'New password must be different from your current password.' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in respective repository
      if (userRole === 'student') {
        await db.students.update(matchedUser.id, {
          password: hashedPassword
        });
      } else if (userRole === 'superadmin' || (userRole === 'staff' && matchedUser.role === 'staff')) {
        await db.staff.update(matchedUser.id, {
          password: hashedPassword,
          failedLoginAttempts: 0
        });
      } else {
        await db.departments.update(matchedUser.key || matchedUser.id, {
          password: hashedPassword
        }, matchedUser.institutionId || req.user.institutionId);
      }

      console.log(`[AUTH CHANGE PASSWORD] Password changed successfully for user ${matchedUser.id} (${userRole})`);

      res.json({
        success: true,
        message: 'Your password has been changed successfully.'
      });
    } catch (error: any) {
      console.error('[AUTH CHANGE PASSWORD] Error:', error);
      res.status(500).json({ error: `System error changing your password: ${error.message || String(error)}` });
    }
  });

  // ==========================================
  // STUDENT PROFILE API ROUTES (PHASE A2)
  // ==========================================

  // Get current authenticated student profile
  app.get('/api/students/me', authenticateToken, requireRole(['student']), async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = req.user!.id;
      const student = await db.students.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }

      // Enforce tenant boundary
      const instId = req.user!.institutionId || 'default';
      if ((student.institutionId || 'default') !== instId) {
        return res.status(403).json({ error: 'Tenant isolation violation: Account belongs to another institution.' });
      }

      const { password, resetPasswordToken, resetPasswordExpires, ...safeProfile } = student as any;
      res.json(safeProfile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve student profile.' });
    }
  });

  // Update authenticated student profile fields (name, contactNumber)
  app.patch('/api/students/me', authenticateToken, requireRole(['student']), async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = req.user!.id;
      const student = await db.students.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }

      // Enforce tenant boundary
      const instId = req.user!.institutionId || 'default';
      if ((student.institutionId || 'default') !== instId) {
        return res.status(403).json({ error: 'Tenant isolation violation: Account belongs to another institution.' });
      }

      const { name, contactNumber, role, institutionId, enrollmentNumber, email, password } = req.body;

      // Reject attempts to alter immutable security credentials
      if (role && role !== 'student') {
        return res.status(400).json({ error: 'Role mutation is strictly prohibited.' });
      }
      if (institutionId && institutionId !== instId) {
        return res.status(400).json({ error: 'Institution reassignment is prohibited.' });
      }
      if (enrollmentNumber && enrollmentNumber !== student.enrollmentNumber) {
        return res.status(400).json({ error: 'Enrollment number is immutable once registered.' });
      }
      if (email && email.toLowerCase().trim() !== student.email.toLowerCase().trim()) {
        return res.status(400).json({ error: 'Email modifications require an authorized security verification workflow.' });
      }
      if (password) {
        return res.status(400).json({ error: 'Please use the authenticated change-password endpoint to update credentials.' });
      }

      const updates: any = {};
      if (name && typeof name === 'string' && name.trim()) {
        updates.name = name.trim();
      }
      if (contactNumber && typeof contactNumber === 'string') {
        const cleanPhone = contactNumber.trim();
        if (!/^[0-9+\-\s()]{7,20}$/.test(cleanPhone)) {
          return res.status(400).json({ error: 'Invalid contact phone number format.' });
        }
        updates.contactNumber = cleanPhone;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid editable fields provided (supported: name, contactNumber).' });
      }

      const updated = await db.students.update(studentId, updates);

      // Record audit log event
      try {
        await db.auditLogs.create({
          adminId: studentId,
          adminName: student.name,
          actionType: 'UPDATE_STUDENT_PROFILE',
          details: `Student updated profile fields: ${Object.keys(updates).join(', ')}`,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
          institutionId: instId
        });
      } catch (logErr) {
        console.warn('[AUDIT LOG WARNING] Failed to record student profile update:', logErr);
      }

      const { password: _, resetPasswordToken: __, resetPasswordExpires: ___, ...safeUpdated } = updated as any;
      res.json({
        success: true,
        message: 'Student profile updated successfully.',
        student: safeUpdated
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update student profile.' });
    }
  });

  /**
   * ==========================================
   * DEPARTMENT API ROUTES
   * ==========================================
   */

  app.get('/api/departments', async (req: any, res) => {
    try {
      const instId = req.query.institutionId || (req.user && req.user.institutionId) || 'default';
      const depts = await db.departments.findMany(instId);
      const sanitized = depts.map(d => {
        const { password, ...safeDept } = d as any;
        return safeDept;
      });
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: 'Could not fetch department registers.' });
    }
  });

  /**
   * ==========================================
   * HELP / COMPLAINT TICKET API ROUTES
   * ==========================================
   */

  // Submit help ticket or complaint
  app.post('/api/requests', authenticateToken, requireRole(['student']), async (req: AuthenticatedRequest, res) => {
    try {
      const { departmentKey, requestType, subject, description, attachments, subDepartmentId } = req.body;
      const student = req.user!;

      let finalDeptKey = departmentKey;
      if (!finalDeptKey) {
        const textForAnalysis = `${subject || ''} ${description || ''}`.toLowerCase();
        if (/\b(bus|transport|shuttle|route|driver|vehicle|cab)\b/.test(textForAnalysis)) finalDeptKey = 'transport';
        else if (/\b(exam|exams|test|marks|grade|grades|re-evaluation|marksheet|results|assessment|re-evaluations)\b/.test(textForAnalysis)) finalDeptKey = 'examination';
        else if (/\b(placement|placements|interview|job|recruitment|career|resume|cv|recruiter)\b/.test(textForAnalysis)) finalDeptKey = 'placement';
        else if (/\b(attendance|course|curriculum|syllabus|professor|class|classes|registration|faculty|academic)\b/.test(textForAnalysis)) finalDeptKey = 'academic';
        else if (/\b(fee|fees|tuition|payment|scholarship|finance|bill|clearances|receipt|receipts|accounts)\b/.test(textForAnalysis)) finalDeptKey = 'accounts';
        else if (/\b(book|library|fine|journal|journals|borrow|librarian|card)\b/.test(textForAnalysis)) finalDeptKey = 'library';
        else if (/\b(hostel|room|mess|boarding|warden|food|rent|laundry)\b/.test(textForAnalysis)) finalDeptKey = 'hostel';
        else if (/\b(wifi|wi-fi|network|internet|portal|password|login|email|credentials|server|itsupport|computer|software|outage)\b/.test(textForAnalysis)) finalDeptKey = 'itsupport';
        else if (/\b(parking|security|safety|decal|building|facilities|facility|admin|administration|document|certification)\b/.test(textForAnalysis)) finalDeptKey = 'administration';
      }

      if (!finalDeptKey || !requestType || !subject || !description) {
        return res.status(400).json({ error: 'Subject, Department, Type, and Description are required.' });
      }

      // Pull student profile to attach current contact number
      const profile = await db.students.findById(student.id);
      if (!profile) {
        return res.status(404).json({ error: 'Student credentials profile missing.' });
      }

      const instId = student.institutionId || 'default';

      let subDeptName = undefined;
      if (subDepartmentId) {
        const subDept = await db.subdepartments.findById(subDepartmentId);
        if (subDept && subDept.departmentKey === finalDeptKey && subDept.institutionId === instId) {
          subDeptName = subDept.name;
        }
      }

      const ticket = await db.requests.create({
        studentId: student.id,
        studentName: profile.name,
        enrollmentNumber: profile.enrollmentNumber,
        contactNumber: profile.contactNumber,
        departmentKey: finalDeptKey,
        subDepartmentId: subDepartmentId || undefined,
        subDepartmentName: subDeptName || undefined,
        requestType,
        subject,
        description,
        attachments: attachments || [],
        status: 'pending',
        institutionId: instId,
        priority: 'medium',
        timeline: [
          {
            step: 'submitted',
            title: 'Student Submitted',
            subtitle: 'Complaint has been officially registered on the CampusConnect ERP network.',
            timestamp: new Date().toISOString(),
            actor: profile.name,
            remarks: 'Submitted via student portal.'
          }
        ],
        updatedAt: new Date().toISOString()
      } as any);

      // Submit automatic notification to department staff
      await db.notifications.create({
        title: `New ${requestType === 'complaint' ? 'Complaint' : 'Help Request'}`,
        message: `Student ${profile.name} (${profile.enrollmentNumber}) submitted: "${subject}"`,
        recipientId: finalDeptKey,
        recipientRole: 'staff',
        institutionId: instId,
      });

      // Trigger Email Notification System background notifications
      handleSubmissionNotifications(ticket.id).catch(err => {
        console.error('Email pipeline submission trigger error:', err);
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error('Error creating request:', error);
      res.status(500).json({ error: 'Failed to submit help or complaint request.' });
    }
  });

  // Filtered ticket retriever
  app.get('/api/requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { status, type, search, page, limit } = req.query;
      let tickets: HelpComplaintRequest[] = [];

      const instId = user.institutionId || 'default';
      const instFilter: any = instId === 'default'
        ? { $or: [{ institutionId: 'default' }, { institutionId: { $exists: false } }, { institutionId: null }, { institutionId: '' }] }
        : { institutionId: instId };

      // Query authorization filtering directly scoped to institution
      if (user.role === 'student') {
        tickets = await db.requests.findMany({ studentId: user.id, ...instFilter });
      } else if (user.role === 'staff') {
        tickets = await db.requests.findMany({ departmentKey: user.departmentKey, ...instFilter });
      } else if (user.role === 'superadmin') {
        tickets = await db.requests.findMany(instFilter);
      }

      // Enforce institution-level tenant isolation
      tickets = tickets.filter(t => (t as any).institutionId === instId || (!t.institutionId && instId === 'default'));

      // Filter query parameters
      if (status) {
        tickets = tickets.filter(t => t.status === status);
      }
      if (type) {
        tickets = tickets.filter(t => t.requestType === type);
      }
      if (search) {
        const query = (search as string).toLowerCase();
        tickets = tickets.filter(t => 
          t.subject.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.enrollmentNumber.toLowerCase().includes(query) ||
          t.studentName.toLowerCase().includes(query)
        );
      }

      // Server-side pagination if requested
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
        const total = tickets.length;
        const totalPages = Math.ceil(total / pageSize);
        const paginatedTickets = tickets.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        return res.json({
          data: paginatedTickets,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            totalPages
          }
        });
      }

      res.json(tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: 'Failed to download request records.' });
    }
  });

  // Ticket detail query
  app.get('/api/requests/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const ticket = await db.requests.findById(id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      // Isolation authorization checks
      const instId = user.institutionId || 'default';
      const ticketInstId = (ticket as any).institutionId || 'default';
      if (instId !== ticketInstId) {
        return res.status(403).json({ error: 'Access denied: Resource belongs to another educational institution.' });
      }

      if (user.role === 'student' && ticket.studentId !== user.id) {
        return res.status(403).json({ error: 'Unauthorized credentials accessor.' });
      }
      if (user.role === 'staff' && ticket.departmentKey !== user.departmentKey) {
        return res.status(403).json({ error: 'Your staff permissions restrict ticket access to your active department.' });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to pull ticket information.' });
    }
  });

  // Update request ticket status & remarks (restricted to Staff & SuperAdmin)
  app.patch('/api/requests/:id/status', authenticateToken, requireRole(['staff', 'superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;
      const staffUser = req.user!;

      if (!status) {
        return res.status(400).json({ error: 'Missing target status assignment.' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Target request record not found.' });
      }

      // Enforce institution-level tenant isolation
      const instId = staffUser.institutionId || 'default';
      const ticketInstId = (ticket as any).institutionId || 'default';
      if (instId !== ticketInstId) {
        return res.status(403).json({ error: 'Access denied: Resource belongs to another educational institution.' });
      }

      // Staff can only update requests belonging to their department
      if (staffUser.role === 'staff' && ticket.departmentKey !== staffUser.departmentKey) {
        return res.status(403).json({ error: 'Restricted database action context.' });
      }

      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];
      let stepName = 'updated';
      let eventTitle = 'Status Updated';
      let eventSubtitle = `Ticket status changed to ${status}.`;

      if (status === 'assigned') {
        stepName = 'assigned';
        eventTitle = 'Officer Assigned';
        eventSubtitle = 'An official coordinator has been assigned to investigate this request.';
      } else if (status === 'in_progress') {
        stepName = 'in_progress';
        eventTitle = 'Action Taken';
        eventSubtitle = 'Designated staff officers have initiated resolution procedures.';
      } else if (status === 'resolved') {
        stepName = 'resolved';
        eventTitle = 'Resolved';
        eventSubtitle = 'Official closure remarks have been posted and ticket is cleared.';
      } else if (status === 'rejected') {
        stepName = 'rejected';
        eventTitle = 'Rejected';
        eventSubtitle = 'Ticket has been rejected by the department with remarks.';
      } else if (status === 'closed') {
        stepName = 'closed';
        eventTitle = 'Closed';
        eventSubtitle = 'Ticket has been permanently closed.';
      }

      timeline.push({
        step: stepName,
        title: eventTitle,
        subtitle: eventSubtitle,
        timestamp: new Date().toISOString(),
        actor: staffUser.name,
        remarks: remarks || 'No additional remarks provided.',
        statusChange: `${ticket.status} ➔ ${status}`
      });

      const updates: Partial<HelpComplaintRequest> = { 
        status: status as RequestStatus,
        timeline: timeline as any,
        updatedAt: new Date().toISOString()
      };

      if (remarks !== undefined) {
        updates.remarks = remarks;
      }
      if (status === 'resolved' || status === 'closed') {
        updates.resolvedAt = new Date().toISOString();
      }

      const updatedTicket = await db.requests.update(id, updates);

      // Notify the student of status modifications in their request
      await db.notifications.create({
        title: `Ticket Status Action Completed`,
        message: `Your ticket regarding "${ticket.subject}" has been marked [${status.toUpperCase()}] by ${staffUser.name}.`,
        recipientId: ticket.studentId,
        recipientRole: 'student',
        institutionId: instId,
      });

      if (status === 'resolved') {
        handleResolutionNotifications(updatedTicket.id).catch(err => {
          console.error('Email pipeline resolution trigger error:', err);
        });
      }

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error modifying ticket status:', error);
      res.status(500).json({ error: 'Failed to capture updating remarks and status details.' });
    }
  });

  // Assign Officer to request (restricted to Staff & SuperAdmin)
  app.patch('/api/requests/:id/assign-officer', authenticateToken, requireRole(['staff', 'superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { officerId } = req.body;
      const staffUser = req.user!;

      if (!officerId) {
        return res.status(400).json({ error: 'Officer selection is required.' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Request ticket not found.' });
      }

      const instId = staffUser.institutionId || 'default';
      const ticketInstId = (ticket as any).institutionId || 'default';
      if (instId !== ticketInstId) {
        return res.status(403).json({ error: 'Access denied: Tenant isolation policy violation.' });
      }

      // Resolve officer name
      const officer = await db.staff.findById(officerId);
      if (!officer) {
        return res.status(404).json({ error: 'Selected officer not found in university register.' });
      }

      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];
      let newStatus = ticket.status;
      if (ticket.status === 'pending') {
        newStatus = 'assigned';
      }

      timeline.push({
        step: 'assigned',
        title: 'Officer Assigned',
        subtitle: `Investigating officer ${officer.name} has been assigned.`,
        timestamp: new Date().toISOString(),
        actor: staffUser.name,
        remarks: `Assigned responsibility to officer ${officer.name} (${officer.designation || 'Staff'}).`,
        statusChange: `${ticket.status} ➔ ${newStatus}`
      });

      const updatedTicket = await db.requests.update(id, {
        status: newStatus,
        officerId,
        officerName: officer.name,
        timeline: timeline as any,
        updatedAt: new Date().toISOString()
      } as any);

      await db.notifications.create({
        title: 'Officer Assigned to Ticket',
        message: `Officer ${officer.name} has been assigned to resolve: "${ticket.subject}"`,
        recipientId: ticket.studentId,
        recipientRole: 'student',
        institutionId: instId,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error assigning officer:', error);
      res.status(500).json({ error: 'Failed to assign officer.' });
    }
  });

  // Mark/update ticket priority (restricted to Staff & SuperAdmin)
  app.patch('/api/requests/:id/priority', authenticateToken, requireRole(['staff', 'superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { priority } = req.body;
      const staffUser = req.user!;

      if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ error: 'A valid priority level (low, medium, high, urgent) is required.' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Request ticket not found.' });
      }

      const instId = staffUser.institutionId || 'default';
      const ticketInstId = (ticket as any).institutionId || 'default';
      if (instId !== ticketInstId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];
      timeline.push({
        step: 'priority_updated',
        title: 'Priority Escaled',
        subtitle: `Ticket priority has been reassessed as ${priority.toUpperCase()}.`,
        timestamp: new Date().toISOString(),
        actor: staffUser.name,
        remarks: `Urgency levels adjusted to ${priority}.`
      });

      const updatedTicket = await db.requests.update(id, {
        priority: priority as any,
        timeline: timeline as any,
        updatedAt: new Date().toISOString()
      } as any);

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error changing ticket priority:', error);
      res.status(500).json({ error: 'Failed to update priority.' });
    }
  });

  // Update internal notes (restricted to Staff & SuperAdmin)
  app.patch('/api/requests/:id/internal-notes', authenticateToken, requireRole(['staff', 'superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { internalNotes } = req.body;
      const staffUser = req.user!;

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Request ticket not found.' });
      }

      const instId = staffUser.institutionId || 'default';
      const ticketInstId = (ticket as any).institutionId || 'default';
      if (instId !== ticketInstId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const updatedTicket = await db.requests.update(id, {
        internalNotes,
        updatedAt: new Date().toISOString()
      } as any);

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error updating internal notes:', error);
      res.status(500).json({ error: 'Failed to update internal notes.' });
    }
  });

  // Submit Student Feedback (restricted to Student who submitted the ticket)
  app.post('/api/requests/:id/feedback', authenticateToken, requireRole(['student']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { rating, remarks } = req.body;
      const student = req.user!;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Satisfaction rating must be a valid number between 1 and 5.' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      if (ticket.studentId !== student.id) {
        return res.status(403).json({ error: 'Permission denied: You can only provide feedback for your own tickets.' });
      }

      const instId = student.institutionId || 'default';
      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];

      timeline.push({
        step: 'feedback_received',
        title: 'Student Feedback Received',
        subtitle: `The student has provided a satisfaction rating of ${rating}/5.`,
        timestamp: new Date().toISOString(),
        actor: ticket.studentName,
        remarks: remarks || `Rated ${rating}/5.`
      });

      // Automatically close ticket upon feedback submission if it is resolved/active
      const updatedTicket = await db.requests.update(id, {
        status: 'closed',
        feedback: {
          rating,
          remarks: remarks || '',
          createdAt: new Date().toISOString()
        },
        timeline: timeline as any,
        updatedAt: new Date().toISOString(),
        resolvedAt: ticket.resolvedAt || new Date().toISOString()
      } as any);

      // Notify department staff
      await db.notifications.create({
        title: 'Satisfaction Feedback Received',
        message: `Student ${ticket.studentName} rated resolution of "${ticket.subject}" as ${rating}/5.`,
        recipientId: ticket.departmentKey,
        recipientRole: 'staff',
        institutionId: instId,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to record student satisfaction feedback.' });
    }
  });

  // Reopen Request Ticket (restricted to Student who submitted the ticket)
  app.patch('/api/requests/:id/reopen', authenticateToken, requireRole(['student']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const student = req.user!;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: 'Please provide a valid reason for reopening this ticket (minimum 5 characters).' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      if (ticket.studentId !== student.id) {
        return res.status(403).json({ error: 'Permission denied: You can only reopen your own tickets.' });
      }

      const instId = student.institutionId || 'default';
      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];

      timeline.push({
        step: 'reopened',
        title: 'Ticket Reopened by Student',
        subtitle: `Docket was reopened with reason: ${reason}`,
        timestamp: new Date().toISOString(),
        actor: ticket.studentName,
        remarks: reason
      });

      const updatedTicket = await db.requests.update(id, {
        status: 'pending',
        timeline: timeline as any,
        updatedAt: new Date().toISOString(),
        remarks: `Reopened: ${reason}`
      } as any);

      // Create in-app staff notification
      await db.notifications.create({
        title: 'Ticket Reopened',
        message: `Student ${ticket.studentName} reopened ticket regarding "${ticket.subject}".`,
        recipientId: ticket.departmentKey,
        recipientRole: 'staff',
        institutionId: instId,
      });

      // Trigger Email Notification System background notifications
      handleReopenNotifications(updatedTicket.id, reason).catch(err => {
        console.error('Email pipeline reopen trigger error:', err);
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error reopening ticket:', error);
      res.status(500).json({ error: 'Failed to reopen request ticket.' });
    }
  });

  /**
   * ==========================================
   * NOTIFICATION SYSTEM API ROUTES
   * ==========================================
   */

  app.get('/api/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      let notifs = [];

      if (user.role === 'student') {
        notifs = await db.notifications.findMany({ recipientId: user.id, isRead: false });
      } else if (user.role === 'staff') {
        notifs = await db.notifications.findMany({ recipientId: user.departmentKey, isRead: false });
      } else {
        notifs = await db.notifications.findMany({ recipientRole: 'staff', isRead: false });
      }

      // Enforce multi-tenant filtering on notifications
      notifs = notifs.filter(n => (n as any).institutionId === instId || (!n.institutionId && instId === 'default'));

      res.json(notifs);
    } catch (error) {
      res.status(500).json({ error: 'Could not fetch notification inbox.' });
    }
  });

  app.post('/api/notifications/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const recipientId = user.role === 'student' ? user.id : (user.departmentKey || 'all');
      
      const allNotifs = await db.notifications.findMany({ recipientId });
      for (const n of allNotifs) {
        const ticketInstId = (n as any).institutionId || 'default';
        if (ticketInstId === instId) {
          await db.notifications.update(n.id, { isRead: true });
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear alerts.' });
    }
  });

  /**
   * ==========================================
   * SUPER ADMIN / OPERATIONS API ROUTES
   * ==========================================
   */

  // Fetch all students lists with pagination & search
  app.get('/api/admin/students', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const instId = (req as any).user.institutionId || 'default';
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

      const students = await db.students.findMany({ institutionId: instId });
      let filtered = students.filter(s => (s as any).institutionId === instId || (!s.institutionId && instId === 'default'));

      if (search) {
        filtered = filtered.filter(s =>
          s.name?.toLowerCase().includes(search) ||
          s.enrollmentNumber?.toLowerCase().includes(search) ||
          s.email?.toLowerCase().includes(search)
        );
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginated = (req.query.page || req.query.limit)
        ? filtered.slice((page - 1) * limit, page * limit)
        : filtered;

      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page', String(page));
      res.setHeader('X-Limit', String(limit));
      res.setHeader('X-Total-Pages', String(totalPages));

      if (req.query.envelope === 'true') {
        return res.json({
          data: paginated,
          pagination: { total, page, limit, totalPages }
        });
      }

      res.json(paginated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to download student directory.' });
    }
  });

  // Recind student account entry with strict multi-tenant authorization
  app.delete('/api/admin/students/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Obtain admin institution context exclusively from verified server-side authentication
      const adminInstId = (req as any).user?.institutionId;
      if (!adminInstId || typeof adminInstId !== 'string' || !adminInstId.trim()) {
        return res.status(403).json({ error: 'Administrative institution context missing or invalid.' });
      }

      const normalizedInstId = adminInstId.trim();

      // 2. Perform atomic tenant-scoped deletion (no separate read-then-delete race window)
      const deletedStudent = await db.students.deleteScoped(id, normalizedInstId);

      // 3. If student does not exist or belongs to another institution, return 404 (no information disclosure)
      if (!deletedStudent) {
        return res.status(404).json({ error: 'Target student record not found.' });
      }

      // 4. Audit logging occurs strictly after verified successful deletion
      try {
        await db.auditLogs.create({
          adminId: (req as any).user.id,
          adminName: (req as any).user.name,
          actionType: 'DELETE_STUDENT',
          details: `Deleted student account: ${deletedStudent.name || ''} (${deletedStudent.enrollmentNumber || id})`,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
          institutionId: normalizedInstId
        });
      } catch (auditErr) {
        console.warn('[AUDIT LOG WARNING] Failed to record student deletion audit log:', auditErr);
      }

      res.json({ success: true, message: 'Student account deleted.' });
    } catch (error) {
      sendDbAwareError(res, error, 'Failed to drop student entry');
    }
  });

  // Fetch all departments staff list
  app.get('/api/admin/staff', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const instId = (req as any).user.institutionId || 'default';
      const staffList = await db.staff.findMany({ institutionId: instId, role: 'staff' });
      res.json(staffList);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load department staff panel.' });
    }
  });

  // Create a new actual Staff member
  app.post('/api/admin/staff', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { name, email, departmentKey, employeeId, phone, designation, status } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      if (!name || !email || !departmentKey || !employeeId || !designation) {
        return res.status(400).json({ error: 'Missing required staff fields: name, email, departmentKey, employeeId, and designation.' });
      }

      // Check if email already registered in this institution
      const existingStaff = await db.staff.findByEmail(email.toLowerCase().trim(), instId);
      if (existingStaff) {
        return res.status(400).json({ error: 'A staff member with this email already exists in this institution.' });
      }

      const newStaff = await db.staff.create({
        name,
        email: email.toLowerCase().trim(),
        departmentKey,
        employeeId,
        phone: phone || '',
        designation,
        status: status || 'active',
        role: 'staff',
        disabled: (status || 'active') === 'inactive',
        institutionId: instId,
      });

      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: 'CREATE_STAFF',
        departmentKey,
        details: `Created staff member ${name} (${employeeId}) for department ${departmentKey}`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      return res.status(202).json(newStaff);
    } catch (error: any) {
      console.error('[CREATE STAFF] Error:', error);
      return res.status(500).json({ error: 'Failed to create staff member.' });
    }
  });

  // Update a staff member's details
  app.patch('/api/admin/staff/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, departmentKey, employeeId, phone, designation, status } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      const staffAccount = await db.staff.findById(id);
      if (!staffAccount || ((staffAccount as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) {
        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail !== staffAccount.email) {
          const existing = await db.staff.findByEmail(normalizedEmail, instId);
          if (existing) {
            return res.status(400).json({ error: 'A staff member with this email already exists in this institution.' });
          }
          updates.email = normalizedEmail;
        }
      }
      if (departmentKey !== undefined) updates.departmentKey = departmentKey;
      if (employeeId !== undefined) updates.employeeId = employeeId;
      if (phone !== undefined) updates.phone = phone;
      if (designation !== undefined) updates.designation = designation;
      if (status !== undefined) {
        updates.status = status;
        updates.disabled = status === 'inactive';
      }

      const updatedStaff = await db.staff.update(id, updates);
      
      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: 'UPDATE_STAFF',
        departmentKey: updates.departmentKey || staffAccount.departmentKey,
        details: `Updated staff member ${updates.name || staffAccount.name} (${updates.employeeId || (staffAccount as any).employeeId || id})`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json(updatedStaff);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update staff member details.' });
    }
  });

  // Remove staff profile
  app.delete('/api/admin/staff/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const instId = (req as any).user.institutionId || 'default';
      const staffAccount = await db.staff.findById(id);
      if (!staffAccount || ((staffAccount as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Target staff account not found.' });
      }

      await db.staff.delete(id);

      // Create Audit Log
      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: 'DELETE_STAFF',
        departmentKey: staffAccount.departmentKey,
        details: `Deleted staff member profile ${staffAccount.name}`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json({ success: true, message: 'Staff profile removed.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retract staff profile.' });
    }
  });

  // Establish custom college department (bonus flexibility!)
  app.post('/api/admin/departments', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { key, name, officialPhone, officialEmail, description, head, status, logo, username, password, additionalEmails } = req.body;
      const instId = (req as any).user.institutionId || 'default';
      
      if (!key || !name || !officialPhone || !officialEmail || !username || !password) {
        return res.status(400).json({ error: 'Department name, slug, email, phone, login username, and password are required.' });
      }

      const existingByKey = await db.departments.findByKey(key, instId);
      if (existingByKey) {
        return res.status(400).json({ error: 'A department already exists with that slug.' });
      }

      const existingByUsername = await db.departments.findByUsername(username, instId);
      if (existingByUsername) {
        return res.status(400).json({ error: 'A department login with this username already exists.' });
      }

      const existingByEmail = await db.departments.findByEmail(officialEmail, instId);
      if (existingByEmail) {
        return res.status(400).json({ error: 'A department with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const newDept = await db.departments.create({
        key: key.toLowerCase().trim(),
        name,
        officialPhone,
        officialEmail,
        description: description || '',
        head: head || '',
        status: status || 'active',
        logo: logo || '',
        institutionId: instId,
        username: username.toLowerCase().trim(),
        password: passwordHash,
        additionalEmails: additionalEmails || '',
      });
      res.status(202).json(newDept);
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(500).json({ error: 'Failed to build custom department model.' });
    }
  });

  app.delete('/api/admin/departments/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const instId = (req as any).user.institutionId || 'default';
      
      const allDepts = await db.departments.findMany(instId);
      const targetDept = allDepts.find(d => (d.id === id || d.key === id) && ((d as any).institutionId === instId || (!(d as any).institutionId && instId === 'default')));
      if (!targetDept) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      const allRequests = await db.requests.findMany();
      const activeComplaints = allRequests.filter(reqItem => 
        reqItem.departmentKey === targetDept.key &&
        reqItem.requestType === 'complaint' &&
        !['resolved', 'closed', 'rejected'].includes(reqItem.status)
      );

      if (activeComplaints.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete department. There are ${activeComplaints.length} active unresolved complaint(s) in this department. Please resolve or reassign them first.` 
        });
      }

      await db.departments.delete(targetDept.id);
      res.json({ success: true, message: 'Department deleted successfully.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retract department profile.' });
    }
  });

  // Edit college department details
  app.patch('/api/admin/departments/:key', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { key } = req.params;
      const { name, officialPhone, officialEmail, description, head, status, logo, username, password, additionalEmails } = req.body;
      const instId = (req as any).user.institutionId || 'default';
      
      const targetDept = await db.departments.findByKey(key, instId) || await db.departments.findById(key);
      if (!targetDept || ((targetDept as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (officialPhone !== undefined) updates.officialPhone = officialPhone;
      if (officialEmail !== undefined) updates.officialEmail = officialEmail;
      if (description !== undefined) updates.description = description;
      if (head !== undefined) updates.head = head;
      if (status !== undefined) updates.status = status;
      if (logo !== undefined) updates.logo = logo;
      if (additionalEmails !== undefined) updates.additionalEmails = additionalEmails;

      if (username !== undefined && username.toLowerCase().trim() !== targetDept.username) {
        const existingByUsername = await db.departments.findByUsername(username, instId);
        if (existingByUsername && existingByUsername.id !== targetDept.id) {
          return res.status(400).json({ error: 'This username is already in use by another department.' });
        }
        updates.username = username.toLowerCase().trim();
      }

      if (password !== undefined && password.trim() !== '') {
        if (password.trim().length < 4) {
          return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
        }
        updates.password = await bcrypt.hash(password, 10);
      }

      const updated = await db.departments.update(targetDept.key, updates, instId);
      if (!updated) {
        return res.status(404).json({ error: 'Department not found.' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating department details:', error);
      res.status(500).json({ error: 'Failed to update department details.' });
    }
  });

  // Create Sub-Department
  app.post('/api/admin/subdepartments', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { name, headName, officialEmail, contactNumber, officeLocation, description, status, departmentKey } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      if (!name || !headName || !officialEmail || !contactNumber || !departmentKey) {
        return res.status(400).json({ error: 'Name, Head Name, Official Email, Contact Number, and Main Department are required.' });
      }

      // Check if a sub-department with the same name already exists in this main department of this institution
      const existing = await db.subdepartments.findMany({ name, departmentKey, institutionId: instId });
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'A sub-department with this name already exists in this department.' });
      }

      const subDept = await db.subdepartments.create({
        name: name.trim(),
        headName: headName.trim(),
        officialEmail: officialEmail.trim(),
        contactNumber: contactNumber.trim(),
        officeLocation: (officeLocation || '').trim(),
        description: (description || '').trim(),
        status: status || 'active',
        departmentKey: departmentKey.trim(),
        institutionId: instId
      });

      res.status(201).json(subDept);
    } catch (error) {
      console.error('Error creating subdepartment:', error);
      res.status(500).json({ error: 'Failed to create sub-department.' });
    }
  });

  // Update Sub-Department
  app.patch('/api/admin/subdepartments/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, headName, officialEmail, contactNumber, officeLocation, description, status } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      const subDept = await db.subdepartments.findById(id);
      if (!subDept || subDept.institutionId !== instId) {
        return res.status(404).json({ error: 'Sub-department not found.' });
      }

      if (name !== undefined && name.trim() !== subDept.name) {
        const existing = await db.subdepartments.findMany({ name: name.trim(), departmentKey: subDept.departmentKey, institutionId: instId });
        if (existing && existing.some(s => s.id !== id)) {
          return res.status(400).json({ error: 'A sub-department with this name already exists in this department.' });
        }
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (headName !== undefined) updates.headName = headName.trim();
      if (officialEmail !== undefined) updates.officialEmail = officialEmail.trim();
      if (contactNumber !== undefined) updates.contactNumber = contactNumber.trim();
      if (officeLocation !== undefined) updates.officeLocation = officeLocation.trim();
      if (description !== undefined) updates.description = description.trim();
      if (status !== undefined) updates.status = status;

      const updated = await db.subdepartments.update(id, updates);
      res.json(updated);
    } catch (error) {
      console.error('Error updating subdepartment:', error);
      res.status(500).json({ error: 'Failed to update sub-department.' });
    }
  });

  // Delete Sub-Department
  app.delete('/api/admin/subdepartments/:id', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const instId = (req as any).user.institutionId || 'default';

      const subDept = await db.subdepartments.findById(id);
      if (!subDept || subDept.institutionId !== instId) {
        return res.status(404).json({ error: 'Sub-department not found.' });
      }

      // Check if there are active complaints in this sub-department
      const allRequests = await db.requests.findMany({ subDepartmentId: id });
      const activeComplaints = allRequests.filter(reqItem => 
        reqItem.requestType === 'complaint' &&
        !['resolved', 'closed', 'rejected'].includes(reqItem.status)
      );

      if (activeComplaints.length > 0) {
        return res.status(400).json({
          error: `Cannot delete sub-department. There are ${activeComplaints.length} active unresolved complaint(s) in this sub-department. Please resolve or reassign them first.`
        });
      }

      await db.subdepartments.delete(id);
      res.json({ success: true, message: 'Sub-department deleted successfully.' });
    } catch (error) {
      console.error('Error deleting subdepartment:', error);
      res.status(500).json({ error: 'Failed to delete sub-department.' });
    }
  });

  // Fetch Sub-Departments
  app.get('/api/subdepartments', authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      const instId = user.institutionId || 'default';
      const { departmentKey } = req.query;

      const filter: any = { institutionId: instId };
      if (departmentKey) {
        filter.departmentKey = departmentKey;
      }

      const list = await db.subdepartments.findMany(filter);
      res.json(list);
    } catch (error) {
      console.error('Error fetching subdepartments:', error);
      res.status(500).json({ error: 'Failed to fetch sub-departments.' });
    }
  });

  // Reset staff / department password
  app.post('/api/admin/staff/:id/reset-password', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { password, forcePasswordChange, passwordType } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      if (!password || password.trim().length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      }

      const staffAccount = await db.staff.findById(id);
      if (!staffAccount || ((staffAccount as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Target staff account not found.' });
      }

      const hash = await bcrypt.hash(password, 10);
      const historyItem = { timestamp: new Date().toISOString() };
      const updatedHistory = [...(staffAccount.passwordResetHistory || []), historyItem];

      await db.staff.update(id, {
        password: hash,
        forcePasswordChange: !!forcePasswordChange,
        passwordType: passwordType || 'permanent',
        passwordResetHistory: updatedHistory
      });

      // Create Audit Log
      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: 'RESET_PASSWORD',
        departmentKey: staffAccount.departmentKey,
        details: `Reset password for officer ${staffAccount.username || staffAccount.email}`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      // Send email notification
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: 'CampusConnect Security <onboarding@resend.dev>',
            to: staffAccount.email,
            subject: 'CampusConnect - Your Officer Password Has Been Reset',
            html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e3a8a;">Password Reset by Administrator</h2>
              <p>Hello <strong>${staffAccount.name}</strong>,</p>
              <p>An administrator has reset your password.</p>
              <p>New Temporary Password: <code style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${password}</code></p>
              ${forcePasswordChange ? '<p style="color: #b45309; font-weight: bold;">Note: You are required to change this password on your next sign in.</p>' : ''}
              <p style="font-size: 11px; color: #94a3b8; margin-top: 25px;">CampusConnect Isolated Tenant Services</p>
            </div>`
          });
        } catch (emailErr) {
          console.error('Failed to send reset email:', emailErr);
        }
      }

      res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
      console.error('Error resetting staff password:', error);
      res.status(500).json({ error: 'Failed to reset staff password.' });
    }
  });

  // Toggle disabled state of staff account
  app.post('/api/admin/staff/:id/toggle-disable', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const instId = (req as any).user.institutionId || 'default';
      const staffAccount = await db.staff.findById(id);
      if (!staffAccount || ((staffAccount as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Target staff account not found.' });
      }

      const activeState = staffAccount.disabled === true;
      await db.staff.update(id, { disabled: !activeState });

      // Create Audit Log
      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: !activeState ? 'DISABLE_OFFICER' : 'ENABLE_OFFICER',
        departmentKey: staffAccount.departmentKey,
        details: `${!activeState ? 'Disabled' : 'Enabled'} officer account ${staffAccount.username || staffAccount.email}`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      // Send email notification
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: 'CampusConnect Security <onboarding@resend.dev>',
            to: staffAccount.email,
            subject: 'CampusConnect - Officer Account Status Updated',
            html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e3a8a;">Account Status Update</h2>
              <p>Hello <strong>${staffAccount.name}</strong>,</p>
              <p>Your officer account status has been updated. It is now <strong>${!activeState ? 'DISABLED' : 'ENABLED'}</strong>.</p>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 25px;">CampusConnect Isolated Tenant Services</p>
            </div>`
          });
        } catch (emailErr) {
          console.error('Failed to send status update email:', emailErr);
        }
      }

      res.json({ success: true, disabled: !activeState, message: `Account ${!activeState ? 'disabled' : 'enabled'} successfully.` });
    } catch (error) {
      console.error('Error toggling staff account disable flag:', error);
      res.status(500).json({ error: 'Failed to toggle account disable flag.' });
    }
  });

  // Unlock staff account
  app.post('/api/admin/staff/:id/unlock', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const { id } = req.params;
      const instId = (req as any).user.institutionId || 'default';
      const staffAccount = await db.staff.findById(id);
      if (!staffAccount || ((staffAccount as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Target staff account not found.' });
      }

      await db.staff.update(id, { failedLoginAttempts: 0 });

      // Create Audit Log
      await db.auditLogs.create({
        adminId: (req as any).user.id,
        adminName: (req as any).user.name,
        actionType: 'UNLOCK_OFFICER',
        departmentKey: staffAccount.departmentKey,
        details: `Unlocked officer account ${staffAccount.username || staffAccount.email}`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json({ success: true, message: 'Account unlocked successfully.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to unlock staff account.' });
    }
  });

  // Fetch audit logs with pagination
  app.get('/api/admin/audit-logs', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const instId = (req as any).user.institutionId || 'default';
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));

      const logs = await db.auditLogs.findMany({ institutionId: instId });
      const total = logs.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginated = (req.query.page || req.query.limit)
        ? logs.slice((page - 1) * limit, page * limit)
        : logs;

      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page', String(page));
      res.setHeader('X-Limit', String(limit));
      res.setHeader('X-Total-Pages', String(totalPages));

      if (req.query.envelope === 'true') {
        return res.json({
          data: paginated,
          pagination: { total, page, limit, totalPages }
        });
      }

      res.json(paginated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
  });

  // Change temporary password upon first login
  app.post('/api/auth/change-temporary-password', async (req, res) => {
    try {
      const { username, oldPassword, newPassword, institutionId, role } = req.body;
      const targetInstitutionId = institutionId || 'default';

      if (!username || !oldPassword || !newPassword || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      // Find staff
      let matchedUser = await db.staff.findByEmail(username.trim().toLowerCase(), targetInstitutionId);
      if (!matchedUser) {
        matchedUser = await db.staff.findByUsername(username.trim().toLowerCase(), targetInstitutionId);
      }

      if (!matchedUser) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      const isMatch = await bcrypt.compare(oldPassword, matchedUser.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid current password.' });
      }

      // Check strength
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await db.staff.update(matchedUser.id, {
        password: hash,
        forcePasswordChange: false,
        passwordType: 'permanent'
      });

      // Audit Log
      await db.auditLogs.create({
        adminId: matchedUser.id,
        adminName: matchedUser.name,
        actionType: 'FORCE_CHANGE_PASSWORD',
        departmentKey: matchedUser.departmentKey,
        details: `Officer changed temporary password`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: targetInstitutionId
      });

      res.json({ success: true, message: 'Password updated successfully. Please log in with your new permanent password.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update temporary password.' });
    }
  });

  // Reassign ticket to another department (restricted to SuperAdmin)
  app.patch('/api/requests/:id/reassign', authenticateToken, requireRole(['superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { departmentKey } = req.body;
      const instId = (req as any).user.institutionId || 'default';

      if (!departmentKey) {
        return res.status(400).json({ error: 'Missing target department assignment.' });
      }

      const ticket = await db.requests.findById(id);
      if (!ticket || ((ticket as any).institutionId || 'default') !== instId) {
        return res.status(404).json({ error: 'Target request record not found.' });
      }

      const deptExists = await db.departments.findByKey(departmentKey, instId);
      if (!deptExists) {
        return res.status(400).json({ error: 'Target department does not exist.' });
      }

      const timeline = Array.isArray((ticket as any).timeline) ? [...(ticket as any).timeline] : [];
      timeline.push({
        step: 'reassigned',
        title: 'Department Reassigned',
        subtitle: `Ticket has been reassigned to ${deptExists.name} Department.`,
        timestamp: new Date().toISOString(),
        actor: (req as any).user.name || 'Super Admin',
        remarks: `Reassigned from original department to ${deptExists.name}.`,
        statusChange: `${ticket.status} ➔ ${ticket.status}`
      });

      const updatedTicket = await db.requests.update(id, { 
        departmentKey,
        timeline: timeline as any,
        updatedAt: new Date().toISOString()
      });

      // Notify department staff of new assignment
      await db.notifications.create({
        title: `Reassigned Ticket Received`,
        message: `Ticket "${ticket.subject}" has been reassigned to your department by Super Admin.`,
        recipientId: departmentKey,
        recipientRole: 'staff',
        institutionId: instId,
      });

      // Notify the student about reassignment
      await db.notifications.create({
        title: `Ticket Reassigned`,
        message: `Your ticket regarding "${ticket.subject}" has been reassigned to ${deptExists.name}.`,
        recipientId: ticket.studentId,
        recipientRole: 'student',
        institutionId: instId,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error('Error reassigning ticket:', error);
      res.status(500).json({ error: 'Failed to reassign ticket.' });
    }
  });

  // Multi-department unified statistical analytics endpoint
  app.get('/api/admin/analytics', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const instId = (req as any).user.institutionId || 'default';
      const instFilter: any = instId === 'default'
        ? { $or: [{ institutionId: 'default' }, { institutionId: { $exists: false } }, { institutionId: null }, { institutionId: '' }] }
        : { institutionId: instId };

      const fetchedTickets = await db.requests.findMany(instFilter);
      const fetchedStudents = await db.students.findMany({ institutionId: instId });
      const fetchedDepartments = await db.departments.findMany(instId);
      const fetchedStaff = await db.staff.findMany({ institutionId: instId });

      // Enforce multi-tenant data boundaries directly from scoped database query
      const allTickets = fetchedTickets;
      const allStudents = fetchedStudents;
      const allDepartments = fetchedDepartments;
      const allStaffOfficers = fetchedStaff.filter(s => s.role === 'staff');

      const totalRequests = allTickets.length;
      const pendingCount = allTickets.filter(t => t.status === 'pending').length;
      const progressCount = allTickets.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;
      const resolvedCount = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected').length;
      const closedCount = allTickets.filter(t => t.status === 'closed' || t.status === 'rejected').length;

      const complaintsCount = allTickets.filter(t => t.requestType === 'complaint').length;
      const helpRequestsCount = allTickets.filter(t => t.requestType === 'help').length;

      // Compute statistics for the new redesigned admin panel
      const totalDepartments = allDepartments.length;
      const activeDepartments = allDepartments.filter(d => d.status === 'active').length;
      const totalStaff = fetchedStaff.filter(s => s.role === 'staff').length;
      const activeStaff = fetchedStaff.filter(s => s.role === 'staff' && (s.status === 'active' || !s.disabled)).length;
      
      const totalComplaints = complaintsCount;
      const pendingComplaints = allTickets.filter(t => t.requestType === 'complaint' && t.status === 'pending').length;
      const resolvedComplaints = allTickets.filter(t => t.requestType === 'complaint' && (t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected')).length;

      // Helper for hour calculation
      const getHoursDiff = (startStr: string, endStr: string | undefined): number => {
        if (!startStr || !endStr) return 0;
        const s = new Date(startStr).getTime();
        const e = new Date(endStr).getTime();
        if (isNaN(s) || isNaN(e)) return 0;
        const diff = (e - s) / (3600000);
        return diff > 0 ? parseFloat(diff.toFixed(1)) : 0;
      };

      // Department-wise detailed stats mapping
      const departmentStats = allDepartments.map(dept => {
        const deptTickets = allTickets.filter(t => t.departmentKey === dept.key);
        const complaints = deptTickets.filter(t => t.requestType === 'complaint');
        const helps = deptTickets.filter(t => t.requestType === 'help');

        // Response times calculation (from created to first non-pending status change)
        let totalResponseHours = 0;
        let responseCount = 0;
        deptTickets.forEach(t => {
          if (t.status !== 'pending') {
            const firstEvent = t.timeline?.find(ev => ['assigned', 'in_progress', 'resolved', 'rejected'].includes(ev.step));
            const acceptedTime = firstEvent ? firstEvent.timestamp : (t.updatedAt || t.resolvedAt);
            if (acceptedTime) {
              totalResponseHours += getHoursDiff(t.createdAt, acceptedTime);
              responseCount++;
            }
          }
        });
        const avgResponseTime = responseCount > 0 ? parseFloat((totalResponseHours / responseCount).toFixed(1)) : 0;

        // Resolution times calculation (from created to resolvedAt)
        let totalResolutionHours = 0;
        let resolutionCount = 0;
        deptTickets.forEach(t => {
          if (['resolved', 'closed', 'rejected'].includes(t.status) && t.resolvedAt) {
            totalResolutionHours += getHoursDiff(t.createdAt, t.resolvedAt);
            resolutionCount++;
          }
        });
        const avgResolutionTime = resolutionCount > 0 ? parseFloat((totalResolutionHours / resolutionCount).toFixed(1)) : 0;

        // Satisfaction rating (average of student feedback rating)
        let totalRating = 0;
        let ratingCount = 0;
        deptTickets.forEach(t => {
          if (t.feedback && typeof t.feedback.rating === 'number') {
            totalRating += t.feedback.rating;
            ratingCount++;
          }
        });
        const satisfactionRating = ratingCount > 0 ? parseFloat((totalRating / ratingCount).toFixed(1)) : 0;

        // Last activity time
        let lastActivityTime = '';
        deptTickets.forEach(t => {
          const times = [t.createdAt, t.updatedAt, t.resolvedAt, ...(t.timeline || []).map(ev => ev.timestamp)].filter(Boolean);
          times.forEach(tm => {
            if (!lastActivityTime || new Date(tm!).getTime() > new Date(lastActivityTime).getTime()) {
              lastActivityTime = tm!;
            }
          });
        });

        return {
          key: dept.key,
          name: dept.name,
          total: deptTickets.length,
          totalComplaints: complaints.length,
          totalHelp: helps.length,
          pending: deptTickets.filter(t => t.status === 'pending').length,
          inProgress: deptTickets.filter(t => t.status === 'assigned' || t.status === 'in_progress').length,
          resolved: deptTickets.filter(t => ['resolved', 'closed', 'rejected'].includes(t.status)).length,
          avgResponseTime,
          avgResolutionTime,
          satisfactionRating,
          lastActivityTime: lastActivityTime || null,
        };
      });

      // Sort departments by workload (total tickets desc)
      departmentStats.sort((a, b) => b.total - a.total);

      // Officer-wise detailed stats mapping
      const officerStats = allStaffOfficers.map(officer => {
        const officerTickets = allTickets.filter(t => t.officerId === officer.id);
        const pending = officerTickets.filter(t => ['assigned', 'in_progress'].includes(t.status));
        const completed = officerTickets.filter(t => ['resolved', 'closed', 'rejected'].includes(t.status));

        // Average resolution time for this officer
        let totalResolutionHours = 0;
        let resolutionCount = 0;
        completed.forEach(t => {
          if (t.resolvedAt) {
            totalResolutionHours += getHoursDiff(t.createdAt, t.resolvedAt);
            resolutionCount++;
          }
        });
        const avgResolutionTime = resolutionCount > 0 ? parseFloat((totalResolutionHours / resolutionCount).toFixed(1)) : 0;

        // Last activity of officer
        let lastActivity = officer.lastLogin || officer.createdAt || '';
        officerTickets.forEach(t => {
          const officerEvents = t.timeline?.filter(ev => ev.actor === officer.name);
          officerEvents?.forEach(ev => {
            if (!lastActivity || new Date(ev.timestamp).getTime() > new Date(lastActivity).getTime()) {
              lastActivity = ev.timestamp;
            }
          });
        });

        return {
          id: officer.id,
          name: officer.name,
          departmentKey: officer.departmentKey,
          assignedTicketsCount: officerTickets.length,
          completedTicketsCount: completed.length,
          pendingTicketsCount: pending.length,
          avgResolutionTime,
          lastLogin: officer.lastLogin || null,
          lastActivity: lastActivity || null
        };
      });

      // Compute Sub-Department stats
      const allSubDepartments = await db.subdepartments.findMany({ institutionId: instId });

      const subDepartmentStats = allSubDepartments.map(sub => {
        const subTickets = allTickets.filter(t => t.subDepartmentId === sub.id);
        const complaints = subTickets.filter(t => t.requestType === 'complaint');
        const total = subTickets.length;
        const pending = subTickets.filter(t => t.status === 'pending').length;
        const progress = subTickets.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
        const resolved = subTickets.filter(t => ['resolved', 'closed', 'rejected'].includes(t.status)).length;

        const resolvedPercentage = total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0;
        const pendingPercentage = total > 0 ? parseFloat((((pending + progress) / total) * 100).toFixed(1)) : 0;

        // Average Resolution Time for this sub-department
        let totalResolutionHours = 0;
        let resolutionCount = 0;
        subTickets.forEach(t => {
          if (['resolved', 'closed', 'rejected'].includes(t.status) && t.resolvedAt) {
            totalResolutionHours += getHoursDiff(t.createdAt, t.resolvedAt);
            resolutionCount++;
          }
        });
        const avgResolutionTime = resolutionCount > 0 ? parseFloat((totalResolutionHours / resolutionCount).toFixed(1)) : 0;

        const mainDept = allDepartments.find(d => d.key === sub.departmentKey);

        return {
          id: sub.id,
          name: sub.name,
          departmentKey: sub.departmentKey,
          departmentName: mainDept ? mainDept.name : 'Unknown',
          total,
          totalComplaints: complaints.length,
          pending,
          progress,
          resolved,
          resolvedPercentage,
          pendingPercentage,
          avgResolutionTime
        };
      });

      const topActiveSubDepartments = [...subDepartmentStats]
        .sort((a, b) => b.total - a.total);

      res.json({
        totalRequests,
        pendingCount,
        progressCount,
        resolvedCount,
        closedCount,
        complaintsCount,
        helpRequestsCount,
        totalStudentsCount: allStudents.length,
        departmentStats,
        officerStats,
        totalDepartments,
        activeDepartments,
        totalStaff,
        activeStaff,
        totalComplaints,
        pendingComplaints,
        resolvedComplaints,
        subDepartmentStats,
        topActiveSubDepartments,
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ error: 'Failed to calculate aggregate indicators.' });
    }
  });

  // Health Check & Database Telemetry API (does not expose credentials)
  app.get('/api/system/database-status', async (req, res) => {
    try {
      const diag = getDatabaseDiagnostics();
      res.json({
        ...diag,
        lastChecked: diag.lastConnectionTime || new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking system database health:', error);
      res.status(500).json({ error: 'Failed to retrieve secure database status.' });
    }
  });

  // Database Connection and Status Telemetry API endpoint
  app.get('/api/database-status', authenticateToken, requireRole(['superadmin']), async (req, res) => {
    try {
      const diag = getDatabaseDiagnostics();
      let totalStudents = 0;
      let totalDepartments = 0;
      let totalComplaints = 0;
      let totalHelpRequests = 0;
      let totalStaff = 0;
      let totalRecords = 0;

      if (diag.isMongoConnected || diag.storageMode === 'local') {
        try {
          const students = await db.students.findMany();
          const departments = await db.departments.findMany();
          const requests = await db.requests.findMany();
          const staffList = await db.staff.findMany();

          totalStudents = students.length;
          totalDepartments = departments.length;
          totalComplaints = requests.filter(t => t.requestType === 'complaint').length;
          totalHelpRequests = requests.filter(t => t.requestType === 'help').length;
          totalStaff = staffList.length;
          totalRecords = totalStudents + totalDepartments + requests.length + totalStaff;
        } catch (fetchErr) {
          console.warn('[DB Status] Could not retrieve collection counts during recovery:', fetchErr);
        }
      }

      res.json({
        mongodbUriConfigured: !!process.env.MONGODB_URI,
        isMongoConnected: diag.isMongoConnected,
        status: diag.status,
        mode: diag.mode,
        storageMode: diag.storageMode,
        effectiveDatabaseName: diag.effectiveDatabaseName,
        readyState: diag.readyState,
        isReconnecting: diag.isReconnecting,
        retryAttempts: diag.retryAttempts,
        lastConnectionTime: diag.lastConnectionTime,
        totalRecords,
        counts: {
          students: totalStudents,
          departments: totalDepartments,
          complaints: totalComplaints,
          helpRequests: totalHelpRequests,
          staff: totalStaff
        }
      });
    } catch (error: any) {
      console.error('Error in /api/database-status:', error);
      res.status(500).json({ error: 'Failed to calculate active database diagnostics.' });
    }
  });

  /**
   * ==========================================
   * NOTICEBOARD & ANNOUNCEMENT MANAGEMENT API
   * ==========================================
   */

  async function notifyAnnouncement(announcement: any, instId: string) {
    try {
      // 1. Determine target students & staff
      let students: any[] = [];
      let staffDepts: string[] = [];

      if (announcement.departmentId) {
        // Department-level announcement
        staffDepts = [announcement.departmentId];
        const allStudents = await db.students.findMany();
        students = allStudents.filter(s => 
          ((s as any).institutionId || 'default') === instId && 
          (s as any).departmentKey === announcement.departmentId
        );
      } else {
        // Institution-wide announcement
        if (announcement.targetAudience === 'institution' || announcement.targetAudience === 'all') {
          const depts = await db.departments.findMany(instId);
          staffDepts = depts.map(d => d.key);
          const allStudents = await db.students.findMany();
          students = allStudents.filter(s => ((s as any).institutionId || 'default') === instId);
        } else if (announcement.targetAudience === 'selected_departments') {
          staffDepts = announcement.targetDepartments || [];
          const allStudents = await db.students.findMany();
          students = allStudents.filter(s => 
            ((s as any).institutionId || 'default') === instId && 
            announcement.targetDepartments?.includes((s as any).departmentKey)
          );
        }
      }

      // 2. In-app notifications
      if (students.length > 0) {
        for (const student of students) {
          await db.notifications.create({
            title: `New Announcement: ${announcement.title}`,
            message: announcement.description.length > 100 ? `${announcement.description.slice(0, 97)}...` : announcement.description,
            recipientId: student.id,
            recipientRole: 'student',
            institutionId: instId,
            announcementId: announcement.id
          });
        }
      }

      if (staffDepts.length > 0) {
        for (const deptKey of staffDepts) {
          await db.notifications.create({
            title: `New Institution Announcement: ${announcement.title}`,
            message: announcement.description.length > 100 ? `${announcement.description.slice(0, 97)}...` : announcement.description,
            recipientId: deptKey,
            recipientRole: 'staff',
            institutionId: instId,
            announcementId: announcement.id
          });
        }
      }

      // 3. Email notifications via Resend
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const recipients: string[] = [];
        
        if (announcement.notifyStudents) {
          students.forEach(s => {
            if (s.email) recipients.push(s.email);
          });
        }
        
        if (announcement.notifyStaff) {
          // Query staff accounts belonging to targeted departments
          const allStaff = await db.staff.findMany({ institutionId: instId });
          const targetStaff = allStaff.filter(s => staffDepts.includes(s.departmentKey));
          targetStaff.forEach(s => {
            if (s.email) recipients.push(s.email);
          });
        }

        // Unique emails
        const uniqueRecipients = Array.from(new Set(recipients));
        
        for (const email of uniqueRecipients) {
          try {
            await resend.emails.send({
              from: 'CampusConnect Announcements <onboarding@resend.dev>',
              to: email,
              subject: `CampusConnect - ${announcement.title}`,
              html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; background: #eff6ff; padding: 2px 6px; border: 1px solid #bfdbfe; border-radius: 4px;">
                  ${announcement.category.toUpperCase()}
                </span>
                <h2 style="color: #0f172a; margin-top: 10px; margin-bottom: 5px;">${announcement.title}</h2>
                <p style="color: #64748b; font-size: 11px; margin-bottom: 20px;">
                  Posted By: <strong>${announcement.createdBy} (${announcement.creatorRole.toUpperCase()})</strong> on ${new Date(announcement.publishDate).toLocaleDateString()}
                </p>
                <div style="color: #334155; line-height: 1.5; white-space: pre-wrap; margin-bottom: 25px;">${announcement.description}</div>
                ${announcement.attachmentUrl ? (
                  announcement.attachmentUrl.startsWith('/')
                    ? (process.env.APP_URL
                        ? `<p style="font-size: 12px;"><a href="${process.env.APP_URL.replace(/\/+$/, '')}${announcement.attachmentUrl}" style="color: #2563eb; font-weight: bold; text-decoration: none;">Download Attachment${announcement.attachmentName ? `: ${announcement.attachmentName}` : ''}</a></p>`
                        : `<p style="font-size: 12px; color: #475569;"><strong>Attachment:</strong> ${announcement.attachmentName || 'Document'} (Log in to CampusConnect to view or download)</p>`)
                    : `<p style="font-size: 12px;"><a href="${announcement.attachmentUrl}" style="color: #2563eb; font-weight: bold; text-decoration: none;">Download Attachment${announcement.attachmentName ? `: ${announcement.attachmentName}` : ''}</a></p>`
                ) : ''}
                <p style="font-size: 11px; color: #94a3b8; margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                  CampusConnect Portal Services
                </p>
              </div>`
            });
          } catch (err) {
            console.error(`Failed to send email to ${email}:`, err);
          }
        }
      }
    } catch (e) {
      console.error('Failed to dispatch notifications:', e);
    }
  }

  // Create Announcement
  app.post('/api/announcements', authenticateToken, requireRole(['superadmin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const {
        title,
        description,
        category,
        priority,
        publishDate,
        expiryDate,
        attachmentUrl,
        attachmentFile,
        targetAudience,
        targetDepartments,
        notifyStudents,
        notifyStaff,
        departmentId,
        isPublished,
        isPinned,
      } = req.body;

      if (!title || !description || !category || !priority) {
        return res.status(400).json({ error: 'Missing required announcement fields.' });
      }

      let resolvedAttachmentUrl: string | undefined = undefined;
      let resolvedAttachmentName: string | undefined = undefined;
      let resolvedAttachmentMimeType: string | undefined = undefined;
      let resolvedAttachmentSize: number | undefined = undefined;
      let resolvedAttachmentData: string | undefined = undefined;

      if (attachmentFile && typeof attachmentFile === 'object') {
        const parsedAttachment = validateAnnouncementAttachment(attachmentFile);
        if (!parsedAttachment.isValid) {
          return res.status(400).json({ error: parsedAttachment.error || 'Invalid attachment file.' });
        }
        resolvedAttachmentUrl = '__ATTACHMENT_ENDPOINT__';
        resolvedAttachmentName = parsedAttachment.name;
        resolvedAttachmentMimeType = parsedAttachment.mimeType;
        resolvedAttachmentSize = parsedAttachment.size;
        resolvedAttachmentData = parsedAttachment.dataUrl;
      } else if (typeof attachmentUrl === 'string' && attachmentUrl.trim()) {
        const trimmedUrl = attachmentUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('/uploads/')) {
          return res.status(400).json({ error: 'Attachment URL must begin with http:// or https://.' });
        }
        resolvedAttachmentUrl = trimmedUrl;
      }

      // Role check: Staff can only create announcements for their own department
      let finalDeptId = departmentId;
      let finalAudience = targetAudience;
      let finalTargetDepartments = targetDepartments;

      if (user.role === 'staff') {
        finalDeptId = user.departmentKey;
        finalAudience = 'selected_departments';
        finalTargetDepartments = [user.departmentKey];
      }

      const newAnnouncement = await db.announcements.create({
        institutionId: instId,
        departmentId: finalDeptId || null,
        title,
        description,
        category,
        priority: priority.toLowerCase() as any,
        attachmentUrl: resolvedAttachmentUrl,
        attachmentName: resolvedAttachmentName,
        attachmentMimeType: resolvedAttachmentMimeType,
        attachmentSize: resolvedAttachmentSize,
        attachmentData: resolvedAttachmentData,
        createdBy: user.name || user.email,
        creatorRole: user.role as any,
        publishDate: publishDate || new Date().toISOString(),
        expiryDate: expiryDate || undefined,
        isPublished: isPublished !== undefined ? isPublished : true,
        isPinned: isPinned !== undefined ? isPinned : false,
        isArchived: false,
        targetAudience: finalAudience as any,
        targetDepartments: finalTargetDepartments,
        notifyStudents: notifyStudents !== undefined ? notifyStudents : false,
        notifyStaff: notifyStaff !== undefined ? notifyStaff : false,
      });

      // Send in-app and email notifications if published
      if (newAnnouncement.isPublished) {
        await notifyAnnouncement(newAnnouncement, instId);
      }

      // Create Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'CREATE_ANNOUNCEMENT',
        departmentKey: finalDeptId || undefined,
        details: `Created announcement "${title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.status(201).json(newAnnouncement);
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      res.status(500).json({ error: 'Failed to create announcement.' });
    }
  });

  // Get Announcements
  app.get('/api/announcements', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const allAnnouncements = await db.announcements.findMany({ institutionId: instId });

      const includeDeleted = req.query.deleted === 'true';
      let filtered = allAnnouncements;

      if (includeDeleted) {
        filtered = allAnnouncements.filter(a => a.isDeleted === true);
      } else {
        filtered = allAnnouncements.filter(a => !a.isDeleted);
      }

      if (user.role === 'student') {
        // Students see all published, non-archived announcements (both institution-wide and department-specific)
        filtered = filtered.filter(a => a.isPublished && !a.isArchived);
      } else if (user.role === 'staff') {
        // Staff see all announcements in their department plus institution-wide ones
        const deptKey = (user as any).departmentKey || '';
        filtered = filtered.filter(a => {
          if (a.targetAudience === 'all' || a.targetAudience === 'institution') {
            return true;
          }
          if (a.departmentId && a.departmentId === deptKey) {
            return true;
          }
          if (a.targetAudience === 'selected_departments' && a.targetDepartments?.includes(deptKey)) {
            return true;
          }
          return false;
        });
      }

      res.json(filtered);
    } catch (error: any) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({ error: 'Failed to fetch announcements.' });
    }
  });

  // Edit/Update Announcement
  app.put('/api/announcements/:id', authenticateToken, requireRole(['superadmin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;

      const announcement = await db.announcements.findById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      // Security check: Staff can only edit their own announcements
      if (user.role === 'staff' && announcement.departmentId !== user.departmentKey) {
        return res.status(403).json({ error: 'Forbidden: You cannot edit other department announcements.' });
      }

      const {
        title,
        description,
        category,
        priority,
        publishDate,
        expiryDate,
        attachmentUrl,
        attachmentFile,
        removeAttachment,
        targetAudience,
        targetDepartments,
        notifyStudents,
        notifyStaff,
        isPublished,
        isPinned,
        isArchived
      } = req.body;

      const updates: any = {
        title,
        description,
        category,
        priority: priority?.toLowerCase() as any,
        publishDate,
        expiryDate,
        targetAudience,
        targetDepartments,
        notifyStudents,
        notifyStaff,
        isPublished,
        isPinned,
        isArchived
      };

      // Clean undefined fields
      Object.keys(updates).forEach(key => {
        if ((updates as any)[key] === undefined) {
          delete (updates as any)[key];
        }
      });

      if (attachmentFile && typeof attachmentFile === 'object') {
        const parsedAttachment = validateAnnouncementAttachment(attachmentFile);
        if (!parsedAttachment.isValid) {
          return res.status(400).json({ error: parsedAttachment.error || 'Invalid attachment file.' });
        }
        updates.attachmentUrl = `/api/announcements/${id}/attachment`;
        updates.attachmentName = parsedAttachment.name;
        updates.attachmentMimeType = parsedAttachment.mimeType;
        updates.attachmentSize = parsedAttachment.size;
        updates.attachmentData = parsedAttachment.dataUrl;
      } else if (removeAttachment === true || attachmentUrl === '' || attachmentUrl === null) {
        updates.attachmentUrl = null;
        updates.attachmentName = null;
        updates.attachmentMimeType = null;
        updates.attachmentSize = null;
        updates.attachmentData = null;
      } else if (typeof attachmentUrl === 'string' && attachmentUrl.trim()) {
        const trimmedUrl = attachmentUrl.trim();
        const existingEndpoint = `/api/announcements/${id}/attachment`;
        if (trimmedUrl !== existingEndpoint) {
          if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('/uploads/')) {
            return res.status(400).json({ error: 'Attachment URL must begin with http:// or https://.' });
          }
          updates.attachmentUrl = trimmedUrl;
          updates.attachmentName = null;
          updates.attachmentMimeType = null;
          updates.attachmentSize = null;
          updates.attachmentData = null;
        }
      }

      const wasPublished = announcement.isPublished;
      const updated = await db.announcements.update(id, updates);

      if (updated && updated.isPublished && !wasPublished) {
        await notifyAnnouncement(updated, instId);
      }

      // Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'UPDATE_ANNOUNCEMENT',
        departmentKey: announcement.departmentId || undefined,
        details: `Updated announcement "${announcement.title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating announcement:', error);
      res.status(500).json({ error: 'Failed to update announcement.' });
    }
  });

  // Download / View Announcement Attachment
  app.get('/api/announcements/:id/attachment', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;

      const announcement = await db.announcements.findAttachmentById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement attachment not found.' });
      }

      if (user.role === 'student') {
        if (announcement.isDeleted || !announcement.isPublished || announcement.isArchived) {
          return res.status(403).json({ error: 'Forbidden: Announcement is not currently accessible.' });
        }
      } else if (user.role === 'staff') {
        if (announcement.isDeleted) {
          return res.status(404).json({ error: 'Announcement attachment not found.' });
        }
        const deptKey = (user as any).departmentKey || '';
        const hasStaffAccess =
          announcement.targetAudience === 'all' ||
          announcement.targetAudience === 'institution' ||
          (announcement.departmentId && announcement.departmentId === deptKey) ||
          (announcement.targetAudience === 'selected_departments' && announcement.targetDepartments?.includes(deptKey));
        if (!hasStaffAccess) {
          return res.status(403).json({ error: 'Forbidden: You do not have access to this department attachment.' });
        }
      }

      if (!announcement.attachmentData) {
        return res.status(404).json({ error: 'No uploaded document stored for this announcement.' });
      }

      const match = announcement.attachmentData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(500).json({ error: 'Stored attachment format is invalid.' });
      }

      const mimeType = announcement.attachmentMimeType || match[1] || 'application/octet-stream';
      const buffer = Buffer.from(match[2], 'base64');
      const safeName = (announcement.attachmentName || 'announcement-document').replace(/[\r\n"\\]/g, '_');

      const inlineSafeMimes = new Set([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'text/plain'
      ]);
      const dispositionType = req.query.download === '1' || !inlineSafeMimes.has(mimeType) ? 'attachment' : 'inline';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error serving announcement attachment:', error);
      res.status(500).json({ error: 'Failed to retrieve announcement attachment.' });
    }
  });

  // Delete Announcement (Soft Delete)
  app.delete('/api/announcements/:id', authenticateToken, requireRole(['superadmin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;

      const announcement = await db.announcements.findById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      // Security check: Staff can only delete their own announcements
      if (user.role === 'staff' && announcement.departmentId !== user.departmentKey) {
        return res.status(403).json({ error: 'Forbidden: You cannot delete other department announcements.' });
      }

      // Update announcement with isDeleted = true, etc.
      await db.announcements.update(id, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: `${user.name} (${user.role === 'superadmin' ? 'Admin' : 'Staff'})`,
        deleteReason: 'Deleted by user'
      });

      // Clean up associated student and staff notifications for deleted announcement
      await db.notifications.deleteMany({ announcementId: id });

      // Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'DELETE_ANNOUNCEMENT_SOFT',
        departmentKey: announcement.departmentId || undefined,
        details: `Soft deleted announcement "${announcement.title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json({ success: true, message: 'Announcement deleted successfully.' });
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({ error: 'Failed to delete announcement.' });
    }
  });

  // Restore Soft Deleted Announcement (Superadmin Only)
  app.post('/api/announcements/:id/restore', authenticateToken, requireRole(['superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;

      const announcement = await db.announcements.findById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      // Restore announcement
      await db.announcements.update(id, {
        isDeleted: false,
        deletedAt: undefined,
        deletedBy: undefined,
        deleteReason: undefined
      });

      // Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'RESTORE_ANNOUNCEMENT',
        departmentKey: announcement.departmentId || undefined,
        details: `Restored announcement "${announcement.title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json({ success: true, message: 'Announcement restored successfully.' });
    } catch (error: any) {
      console.error('Error restoring announcement:', error);
      res.status(500).json({ error: 'Failed to restore announcement.' });
    }
  });

  // Permanently Delete Announcement (Superadmin Only)
  app.delete('/api/announcements/:id/permanent', authenticateToken, requireRole(['superadmin']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;

      const announcement = await db.announcements.findById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      await db.announcements.delete(id);

      // Clean up associated student and staff notifications
      await db.notifications.deleteMany({ announcementId: id });

      // Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'DELETE_ANNOUNCEMENT_PERMANENT',
        departmentKey: announcement.departmentId || undefined,
        details: `Permanently deleted announcement "${announcement.title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json({ success: true, message: 'Announcement permanently deleted successfully.' });
    } catch (error: any) {
      console.error('Error permanently deleting announcement:', error);
      res.status(500).json({ error: 'Failed to permanently delete announcement.' });
    }
  });

  // Toggle Actions (Publish, Pin, Archive)
  app.patch('/api/announcements/:id/toggle', authenticateToken, requireRole(['superadmin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const instId = user.institutionId || 'default';
      const { id } = req.params;
      const { field } = req.body;

      if (!['isPublished', 'isPinned', 'isArchived'].includes(field)) {
        return res.status(400).json({ error: 'Invalid field toggle.' });
      }

      const announcement = await db.announcements.findById(id);
      if (!announcement || announcement.institutionId !== instId) {
        return res.status(404).json({ error: 'Announcement not found.' });
      }

      // Security check
      if (user.role === 'staff' && announcement.departmentId !== user.departmentKey) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify other department announcements.' });
      }

      const currentValue = (announcement as any)[field];
      const updated = await db.announcements.update(id, { [field]: !currentValue });

      if (updated && field === 'isPublished' && updated.isPublished) {
        await notifyAnnouncement(updated, instId);
      }

      // Audit Log
      await db.auditLogs.create({
        adminId: user.id,
        adminName: user.name,
        actionType: 'TOGGLE_ANNOUNCEMENT_STATE',
        departmentKey: announcement.departmentId || undefined,
        details: `Toggled "${field}" to ${!currentValue} on announcement "${announcement.title}"`,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
        institutionId: instId
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error toggling announcement state:', error);
      res.status(500).json({ error: 'Failed to toggle state.' });
    }
  });

  /**
   * ==========================================
   * API ROUTE 404 & ERROR HANDLING (JSON SAFE)
   * ==========================================
   */

  // Explicitly return JSON 404 for any unmatched /api/* route so it never falls through to SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Dedicated error handling middleware for API routes returning structured JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error('[API Route Error]', err);
      const isDbDown = err?.statusCode === 503 || err?.isDatabaseUnavailable || err?.name === 'DatabaseUnavailableError' || err?.name === 'MongooseServerSelectionError';
      const status = isDbDown ? 503 : (err.statusCode || err.status || 500);
      return res.status(status).json({
        error: isDbDown ? (err.message || 'Database service is temporarily unavailable. Connection to MongoDB Atlas is recovering. Please retry shortly.') : (err.message || 'An internal system error occurred while processing the request.'),
        isDatabaseUnavailable: isDbDown,
        retryAfterSeconds: isDbDown ? 5 : undefined
      });
    }
    next(err);
  });

  /**
   * ==========================================
   * FRONTEND STATIC BUNDLE / VITE ROUTING
   * ==========================================
   */

  if (!IS_SERVERLESS) {
    if (process.env.NODE_ENV !== 'production') {
      // Mount Vite development server dynamically so production/serverless never bundles Vite
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      // Serve production static React output assets (Render / Cloud Run / Local Prod)
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CampusConnect App] Server running at http://localhost:${PORT}`);
    // Initiate background connection to MongoDB Atlas without blocking HTTP requests
    connectToDatabase(true).catch((err) => {
      console.warn('[DB Init] Background connection attempt initiated:', err?.message || err);
    });
  });

  // Attach Cloud Run graceful shutdown handler
  setupGracefulShutdown(server);
  return server;
}

// Only bind HTTP port when running directly as a persistent Node server (never on Vercel Serverless)
if (!IS_SERVERLESS && process.env.SKIP_SERVER_LISTEN !== 'true') {
  startServer().catch((err) => {
    console.error('[CampusConnect App] Server failed to bootstrap:', err);
    process.exit(1);
  });
}
