import { Request, Response } from 'express';

export interface SyntheticDemoCredentials {
  student: { username: string; password: string };
  department: { username: string; password: string };
  admin: { username: string; password: string };
}

/**
 * Strictly synthetic, non-functional demonstration placeholders.
 * These are never stored in the database and never correspond to real accounts.
 */
export const SYNTHETIC_DEMO_CREDENTIALS: Readonly<SyntheticDemoCredentials> = Object.freeze({
  student: Object.freeze({
    username: 'DEMO_STUDENT_SYNTHETIC',
    password: '[DEMO_ONLY_NOT_ACTIVE]'
  }),
  department: Object.freeze({
    username: 'demo_department_synthetic',
    password: '[DEMO_ONLY_NOT_ACTIVE]'
  }),
  admin: Object.freeze({
    username: 'demo_admin_synthetic@example.invalid',
    password: '[DEMO_ONLY_NOT_ACTIVE]'
  })
});

/**
 * Safe Demo Credentials Handler
 * 
 * Rules:
 * 1. In production (NODE_ENV === 'production'): strictly returns HTTP 404.
 *    Eliminates all public credential discovery in production environments.
 * 2. In development (NODE_ENV !== 'production'): returns ONLY synthetic, non-functional
 *    demonstration placeholders.
 * 3. ZERO database interaction: NEVER queries db.students, db.staff, or db.departments.
 * 4. NEVER returns real student enrollment IDs, admin emails, or usable passwords.
 */
export function handleDemoCredentials(
  req: Request, 
  res: Response, 
  envNodeEnv: string = process.env.NODE_ENV || 'development'
) {
  if (envNodeEnv === 'production') {
    return res.status(404).json({
      error: 'Endpoint not found.'
    });
  }

  return res.json(SYNTHETIC_DEMO_CREDENTIALS);
}
