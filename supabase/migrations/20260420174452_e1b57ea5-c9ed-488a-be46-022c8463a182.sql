-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
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

CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Slots
CREATE TABLE public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  is_occupied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view slots" ON public.slots FOR SELECT USING (true);
CREATE POLICY "Admins insert slots" ON public.slots FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update slots" ON public.slots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete slots" ON public.slots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Devices
CREATE TYPE public.device_status AS ENUM ('checked_in','in_queue','called','collected');

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  owner_name text NOT NULL,
  owner_id_text text,
  owner_email text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slot_id uuid REFERENCES public.slots(id),
  slot_label text,
  status public.device_status NOT NULL DEFAULT 'checked_in',
  photo_url text,
  ringing boolean NOT NULL DEFAULT false,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  queue_time timestamptz,
  called_time timestamptz,
  collection_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Public can insert (self check-in) and read by knowing the id (receipt QR contains id)
CREATE POLICY "Public insert device" ON public.devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read device" ON public.devices FOR SELECT USING (true);

-- Anonymous users can update their own device (join queue, acknowledge ring)
-- Restrict columns via app logic; allow status transitions only away from collected
CREATE POLICY "Public update non-collected" ON public.devices FOR UPDATE
USING (status <> 'collected')
WITH CHECK (status <> 'collected' OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins full devices" ON public.devices FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slots;
ALTER TABLE public.devices REPLICA IDENTITY FULL;
ALTER TABLE public.slots REPLICA IDENTITY FULL;

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('device-photos','device-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read device photos" ON storage.objects FOR SELECT
USING (bucket_id = 'device-photos');
CREATE POLICY "Admins upload device photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'device-photos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update device photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'device-photos' AND public.has_role(auth.uid(),'admin'));

-- Seed slots A-1..A-20, B-1..B-20
INSERT INTO public.slots (label)
SELECT row_letter || '-' || n
FROM (VALUES ('A'),('B'),('C')) AS r(row_letter),
     generate_series(1,20) AS n;