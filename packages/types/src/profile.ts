import { z } from 'zod';

export const ROLE = ['admin', 'student', 'parent'] as const;
export type Role = (typeof ROLE)[number];

export const PROFILE_STATUS = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type ProfileStatus = (typeof PROFILE_STATUS)[number];

export const roleSchema = z.enum(ROLE);
export const profileStatusSchema = z.enum(PROFILE_STATUS);

export type Profile = {
  id: string;
  role: Role;
  status: ProfileStatus;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};
