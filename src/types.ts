export interface Student {
  id: string;
  name: string;
  enrollmentNumber: string;
  email: string;
  contactNumber: string;
  createdAt: string;
  institutionId?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
}

export interface Department {
  id: string;
  key: string;
  name: string;
  officialPhone: string;
  officialEmail: string;
  description: string;
  head?: string;
  status?: 'active' | 'inactive';
  logo?: string;
  institutionId?: string;
  username?: string;
  password?: string;
  additionalEmails?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  departmentKey: string;
  role: 'staff' | 'superadmin';
  disabled?: boolean;
  createdAt: string;
  institutionId?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
  employeeId?: string;
  phone?: string;
  designation?: string;
  status?: 'active' | 'inactive';
}

export type RequestType = 'complaint' | 'help';
export type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'closed';

export interface TimelineEvent {
  step: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  actor?: string;
  remarks?: string;
  statusChange?: string;
}

export interface FeedbackData {
  rating: number;
  remarks?: string;
  createdAt?: string;
}

export interface HelpComplaintRequest {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  contactNumber: string;
  departmentKey: string;
  requestType: RequestType;
  subject: string;
  description: string;
  attachments: string[]; // Base64 strings or URLs
  status: RequestStatus;
  remarks?: string;
  resolvedAt?: string;
  createdAt: string;
  institutionId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  officerId?: string;
  officerName?: string;
  expectedResolutionTime?: string;
  internalNotes?: string;
  feedback?: FeedbackData;
  timeline?: TimelineEvent[];
  updatedAt?: string;
  subDepartmentId?: string;
  subDepartmentName?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  recipientId: string; // studentId, staffId, departmentKey, or 'all'
  recipientRole: 'student' | 'staff' | 'all';
  isRead: boolean;
  createdAt: string;
  institutionId?: string;
  announcementId?: string;
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  logo?: string;
  officialEmail?: string;
  contactNumber?: string;
  description?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
  socialFacebook?: string;
  isTest?: boolean;
  status?: 'active' | 'inactive' | 'test';
  createdAt: string;
  updatedAt?: string;
}

export interface Announcement {
  id: string; // matches announcementId
  announcementId: string;
  institutionId: string;
  departmentId: string | null; // null/empty for institution-wide
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  createdBy: string;
  creatorRole: 'staff' | 'superadmin';
  publishDate: string;
  expiryDate?: string;
  isPublished: boolean;
  isPinned: boolean;
  isArchived: boolean;
  targetAudience: 'institution' | 'selected_departments' | 'all';
  targetDepartments?: string[]; // keys/ids of departments when selected_departments
  notifyStudents: boolean;
  notifyStaff: boolean;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
}

export interface SubDepartment {
  id: string;
  name: string;
  headName: string;
  officialEmail: string;
  contactNumber: string;
  officeLocation?: string;
  description?: string;
  status: 'active' | 'inactive';
  departmentKey: string; // The main department's key/id
  institutionId: string;
  createdAt: string;
  updatedAt?: string;
}

