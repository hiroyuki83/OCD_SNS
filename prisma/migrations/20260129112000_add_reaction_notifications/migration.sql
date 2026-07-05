-- Add new notification types for reactions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WAKARU';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GANBATTA';
