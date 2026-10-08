import { createClient } from '@supabase/supabase-js';

// NOTA: Para administración se requiere el SUPABASE_SERVICE_ROLE_KEY de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.log('Uso: NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co" SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key" node scripts/invite-user.mjs email@caminoselva.com "Nombre Operador"');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = process.argv[2];
const nombre = process.argv[3] || email.split('@')[0];

if (!email) {
  console.error('Error: Debe especificar un correo electrónico.');
  process.exit(1);
}

async function invite() {
  console.log(`Enviando invitación por correo a ${email} (${nombre})...`);
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { nombre: nombre }
  });

  if (error) {
    console.error('Error al invitar usuario:', error.message);
  } else {
    console.log(`¡Invitación enviada con éxito a ${email}! ID de usuario: ${data.user.id}`);
  }
}

invite();
