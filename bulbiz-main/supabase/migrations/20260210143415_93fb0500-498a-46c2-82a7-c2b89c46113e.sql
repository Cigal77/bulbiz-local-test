
-- Enum types
CREATE TYPE public.dossier_status AS ENUM ('nouveau', 'a_qualifier', 'devis_a_faire', 'devis_envoye', 'clos_signe', 'clos_perdu');
CREATE TYPE public.dossier_source AS ENUM ('lien_client', 'manuel', 'email');
CREATE TYPE public.urgency_level AS ENUM ('aujourdhui', '48h', 'semaine');
CREATE TYPE public.problem_category AS ENUM ('wc', 'fuite', 'chauffe_eau', 'evier', 'douche', 'autre');
CREATE TYPE public.app_role AS ENUM ('admin', 'artisan');

-- Profiles table (auto-created on signup)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  email_signature TEXT,
  auto_relance_enabled BOOLEAN NOT NULL DEFAULT true,
  relance_delay_info INTEGER NOT NULL DEFAULT 1,
  relance_delay_devis_1 INTEGER NOT NULL DEFAULT 2,
  relance_delay_devis_2 INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Dossiers table
CREATE TABLE public.dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- Client info
  client_first_name TEXT NOT NULL,
  client_last_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  -- Intervention
  address TEXT NOT NULL,
  category problem_category NOT NULL DEFAULT 'autre',
  urgency urgency_level NOT NULL DEFAULT 'semaine',
  description TEXT,
  -- Meta
  source dossier_source NOT NULL DEFAULT 'manuel',
  status dossier_status NOT NULL DEFAULT 'nouveau',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Client link
  client_token TEXT UNIQUE,
  client_token_expires_at TIMESTAMPTZ,
  -- Relances
  relance_active BOOLEAN NOT NULL DEFAULT true,
  relance_count INTEGER NOT NULL DEFAULT 0,
  last_relance_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medias table
CREATE TABLE public.medias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique table
CREATE TABLE public.historique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relances table
CREATE TABLE public.relances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relances ENABLE ROW LEVEL SECURITY;

-- Security definer function for roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies: user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies: dossiers
CREATE POLICY "Users can view own dossiers" ON public.dossiers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own dossiers" ON public.dossiers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dossiers" ON public.dossiers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dossiers" ON public.dossiers FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: medias
CREATE POLICY "Users can view own medias" ON public.medias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own medias" ON public.medias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own medias" ON public.medias FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: historique (user_id can be null for system events)
CREATE POLICY "Users can view historique of own dossiers" ON public.historique FOR SELECT
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));
CREATE POLICY "Users can create historique for own dossiers" ON public.historique FOR INSERT
  WITH CHECK (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

-- RLS Policies: relances
CREATE POLICY "Users can view own relances" ON public.relances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own relances" ON public.relances FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'artisan');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON public.dossiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for medias
INSERT INTO storage.buckets (id, name, public) VALUES ('dossier-medias', 'dossier-medias', true);

CREATE POLICY "Users can upload own medias" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'dossier-medias' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own medias" ON storage.objects FOR SELECT USING (bucket_id = 'dossier-medias' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own medias" ON storage.objects FOR DELETE USING (bucket_id = 'dossier-medias' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public can view dossier medias" ON storage.objects FOR SELECT USING (bucket_id = 'dossier-medias');
