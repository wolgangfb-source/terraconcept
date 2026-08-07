// Configuración pública del cotizador.
//
// La `publishable key` está diseñada para viajar en el navegador: no es un
// secreto. Lo que protege los datos son las políticas RLS de Supabase, que
// exigen sesión iniciada para leer o escribir cualquier tabla.
//
// Nunca poner aquí la contraseña de la base de datos ni la service_role key:
// este repo es público.

export const SUPABASE_URL = 'https://tguoquizfjcalrqvxqey.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_24Sn0pqmRholKmpjMqpXNw_174Lo5H9';
