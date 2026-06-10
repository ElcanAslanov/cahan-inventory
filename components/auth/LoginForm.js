"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const urlError = searchParams.get("error");

  useEffect(() => {
    const timer = setTimeout(() => {
      document.body.classList.add("auth-ready");
    }, 80);

    return () => {
      clearTimeout(timer);
      document.body.classList.remove("auth-ready");
    };
  }, []);

  async function handleLogin(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError("Email və ya şifrə yanlışdır.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <>
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-grid-lines" />

      <section className="auth-shell">
        <div className="auth-visual">
          <div className="auth-brand auth-animate auth-delay-1">
            <div className="auth-logo">
              <span>CI</span>
            </div>

            <div>
              <p>Cahan Holding</p>
              <h1>Cahan İnventar</h1>
            </div>
          </div>

          <div className="auth-hero auth-animate auth-delay-2">
            <div className="auth-pill">
              <span className="auth-live-dot" />
              İnventar İdarəetmə Sistemi
            </div>

            <h2>
              Inventarları, əsas vəsaitləri və təhkimləri vahid paneldə idarə
              et.
            </h2>

            <p>
              Şirkətlər üzrə avadanlıq qeydiyyatı, məsul şəxslər, sənədlər,
              statuslar və hərəkət tarixçəsi üçün sürətli və modern platforma.
            </p>
          </div>

          <div className="auth-floating-stack auth-animate auth-delay-3">
            <div className="auth-float-card auth-float-main">
              <div className="auth-float-top">
                <span>Ümumi Baxış</span>
                <strong>98%</strong>
              </div>

              <div className="auth-progress">
                <span />
              </div>

              <div className="auth-mini-list">
                <p>
                  <span className="auth-dot blue" />
                  Aktiv inventarlar
                  <b>428</b>
                </p>

                <p>
                  <span className="auth-dot cyan" />
                  Təhkim olunmuş
                  <b>312</b>
                </p>

                <p>
                  <span className="auth-dot amber" />
                  Təmirdə
                  <b>18</b>
                </p>
              </div>
            </div>

            <div className="auth-float-card auth-float-small">
              <span className="auth-scan-icon">⌁</span>

              <div>
                <strong>Ciddi izləmə</strong>
                <p>Model, kod və sənədlər</p>
              </div>
            </div>

            <div className="auth-float-card auth-float-tiny">
              <strong>+24</strong>
              <span>Yeni imkanlar</span>
            </div>
          </div>
        </div>

        <div className="auth-form-zone">
          <form
            onSubmit={handleLogin}
            className="auth-card auth-animate auth-delay-4"
          >
            <div className="auth-card-header">
              <h3>Xoş gəlmişsiniz!</h3>
            </div>

            {urlError === "inactive" && (
              <div className="auth-alert">Hesabınız aktiv deyil.</div>
            )}

            {error && <div className="auth-alert">{error}</div>}

            <label className="auth-field">
              <span>Email</span>

              <input
                type="email"
                placeholder="email@cahan.az"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-field">
              <span>Şifrə</span>

              <div className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Şifrənizi yazın"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Gizlə" : "Göstər"}
                </button>
              </div>
            </label>

            <button type="submit" disabled={loading} className="auth-submit">
              <span>{loading ? "Daxil olunur..." : "Daxil ol"}</span>
              <i>→</i>
            </button>

            <div className="auth-card-footer">
              <span />
              <p>Yalnız aktiv istifadəçilər üçün giriş icazəlidir.</p>
              <span />
            </div>
          </form>
        </div>
      </section>
    </>
  );
}