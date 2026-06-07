-- ==========================================
-- WeCareBidar - DATABASE & STORAGE SETUP
-- Run this script in the Supabase SQL Editor
-- ==========================================

-- 1. Create Submissions Status Enum
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Create Profiles Table (Publicly readable profiles synced with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT, -- Nullable to support Phone Auth
    phone TEXT, -- To support Phone OTP signup
    full_name TEXT, -- User display name
    avatar_url TEXT, -- User profile picture public URL
    interests TEXT[], -- Array of selected civic areas of interest
    district TEXT, -- User district in Bidar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to profiles so anyone can see contributor details in the feeds
CREATE POLICY "Allow public read access to profiles"
ON public.profiles
FOR SELECT
TO public
USING (true);

-- Allow users to update their own profiles (full_name, avatar_url)
CREATE POLICY "Allow owners to update their profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Create Trigger Function to automatically create profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (new.id, new.email, new.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Create Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Links submission to the profile
    user_description TEXT NOT NULL,
    video_url TEXT, -- Temporarily holds public URL, will be set to NULL after posting
    title TEXT, -- Campaign title
    location TEXT, -- Operation zone/location
    category TEXT, -- Environmental category
    status moderation_status DEFAULT 'pending'::moderation_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security (RLS) on Submissions Table
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Submissions Table

-- Policy A: Allow authenticated users to insert their own submissions
CREATE POLICY "Allow authenticated user submissions" 
ON public.submissions 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id AND status = 'pending'::moderation_status);

-- Policy A.2: Allow anonymous user submissions
CREATE POLICY "Allow anonymous user submissions" 
ON public.submissions 
FOR INSERT 
TO anon 
WITH CHECK (user_id IS NULL AND status = 'pending'::moderation_status);

-- Policy B: Allow users to view their own submissions (to calculate statistics counts)
CREATE POLICY "Allow users to view own submissions" 
ON public.submissions 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy C: Allow Admins to fetch and edit all submissions (Service role or client checks)
CREATE POLICY "Allow authenticated admin reads" 
ON public.submissions 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated admin updates" 
ON public.submissions 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Policy D: Allow anonymous client-side reads of pending list (fallback validation check)
CREATE POLICY "Allow admin read pending submissions"
ON public.submissions
FOR SELECT
TO anon
USING (status = 'pending'::moderation_status);

CREATE POLICY "Allow admin updates"
ON public.submissions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy E: Allow public client-side reads of approved submissions (for landing feed)
CREATE POLICY "Allow public read of approved submissions"
ON public.submissions
FOR SELECT
TO public
USING (status = 'approved'::moderation_status);


-- 6. Supabase Storage Setup (temporary-videos Bucket)
-- Register the bucket in the Supabase Storage system
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'temporary-videos', 
    'temporary-videos', 
    true, -- Public read for social API scrapers, restricted deletion/listing
    41943040, -- 40MB limit (in bytes)
    '{"video/mp4"}'
)
ON CONFLICT (id) DO UPDATE SET 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for Storage Objects (storage.objects table)

-- Policy A: Allow authenticated users to upload videos
CREATE POLICY "Allow authenticated uploads to temporary-videos" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'temporary-videos');

-- Policy A.2: Allow anonymous uploads to temporary-videos
CREATE POLICY "Allow anonymous uploads to temporary-videos" 
ON storage.objects 
FOR INSERT 
TO anon
WITH CHECK (bucket_id = 'temporary-videos');

-- Policy B: Allow anyone (anon & social API scrapers) to read video files by direct URL
CREATE POLICY "Allow public read to temporary-videos" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'temporary-videos');

-- Policy C: Allow deletions by admin actions
CREATE POLICY "Allow admin deletions from temporary-videos" 
ON storage.objects 
FOR DELETE 
TO anon
USING (bucket_id = 'temporary-videos');


-- 7. Supabase Storage Setup (avatars Bucket for Profile Pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'avatars', 
    'avatars', 
    true, -- Public read for user avatars
    5242880, -- 5MB limit
    '{"image/png", "image/jpeg", "image/gif", "image/webp"}'
)
ON CONFLICT (id) DO UPDATE SET 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for avatars Storage Objects

CREATE POLICY "Allow public read to avatars" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated uploads to avatars" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated updates in avatars" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated deletions from avatars" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'avatars');
