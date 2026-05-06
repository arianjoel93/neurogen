import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateUserBody = {
  email?: string;
  fullName?: string;
  password?: string;
  role?: "superuser" | "staff";
  color?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Faltan variables de entorno de Supabase.");
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return json({ error: "No autorizado." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: callerError,
    } = await userClient.auth.getUser();

    if (callerError || !caller) {
      return json({ error: "Sesión inválida." }, 401);
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role,status")
      .eq("id", caller.id)
      .single();

    if (profileError || callerProfile?.role !== "superuser" || callerProfile?.status !== "active") {
      return json({ error: "Solo el superusuario puede crear cuentas." }, 403);
    }

    const body = (await request.json()) as CreateUserBody;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const password = body.password?.trim();
    const role = body.role ?? "staff";
    const color = /^#[0-9A-Fa-f]{6}$/.test(body.color ?? "") ? body.color : "#0f766e";

    if (!email || !fullName || !password) {
      return json({ error: "Nombre, correo y contraseña son obligatorios." }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        color,
      },
    });

    if (createError || !created.user) {
      return json({ error: createError?.message ?? "No se pudo crear el usuario." }, 400);
    }

    const { data: profile, error: upsertError } = await adminClient
      .from("profiles")
      .upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role,
        status: "active",
        color,
        created_by: caller.id,
      })
      .select("*")
      .single();

    if (upsertError) {
      return json({ error: upsertError.message }, 400);
    }

    return json({ profile }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido." }, 500);
  }
});

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
