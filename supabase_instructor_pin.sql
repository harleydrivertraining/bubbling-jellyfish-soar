-- Force update any existing profiles missing a PIN
UPDATE public.profiles 
SET instructor_pin = floor(random() * 9000 + 1000)::text
WHERE (instructor_pin IS NULL OR instructor_pin = '')
AND (role = 'instructor' OR role = 'owner');