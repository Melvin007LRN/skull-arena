
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "../lib/supabase";

type AuthPanelProps = {
  onAuthenticated?: () => void;
};

export default function AuthPanel({
  onAuthenticated,
}: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);

      if (session) {
        onAuthenticated?.();
      }
    });

    return () => subscription.unsubscribe();
  }, [onAuthenticated]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "register" && username.trim().length < 3) {
      setMessage("Le pseudonyme doit contenir au moins 3 caractères.");
      return;
    }

    if (password.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Bienvenue dans Skull Arena !");
          onAuthenticated?.();
        } else {
          setMessage(
            "Compte créé ! Vérifie tes e-mails pour confirmer ton inscription."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("Connexion réussie !");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Tu es déconnecté.");
  }

  if (sessionEmail) {
    return (
      <section className="auth-panel">
        <h2>Bienvenue, pirate !</h2>
        <p>Connecté avec : {sessionEmail}</p>
        <button type="button" onClick={handleLogout}>
          Se déconnecter
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel">
      <h2>
        {mode === "login" ? "Connexion" : "Rejoindre Skull Arena"}
      </h2>

      <p>
        {mode === "login"
          ? "Retrouve ton équipage et reprends la partie."
          : "Crée ton compte et entre dans l'arène."}
      </p>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <input
            type="text"
            placeholder="Ton pseudonyme"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={20}
            required
          />
        )}

        <input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe (6 caractères minimum)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "login" ? "current-password" : "new-password"
          }
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Chargement..."
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "Pas encore de compte ? S'inscrire"
          : "Déjà un compte ? Se connecter"}
      </button>
    </section>
  );
}
