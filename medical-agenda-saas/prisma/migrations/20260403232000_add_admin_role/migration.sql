-- Root-cause fix: include admin in canonical Role enum used across auth and API guards
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin';
