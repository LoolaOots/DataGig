-- Enable Supabase Realtime for notifications table
-- Run this in the Supabase SQL editor after 001_auth_trigger.sql

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
