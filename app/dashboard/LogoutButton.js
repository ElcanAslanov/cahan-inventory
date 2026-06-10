"use client";

import { supabase } from "../../lib/supabaseClient";

export default function LogoutButton() {
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button onClick={logout} className="dash-logout-btn">
      Çıxış
    </button>
  );
}