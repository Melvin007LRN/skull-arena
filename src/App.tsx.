
import { useState } from "react";
import {
  Anchor,
  Crown,
  Shield,
  Swords,
  Trophy,
  Users,
  Lock,
  Compass,
  Skull,
  ChevronRight,
  Ship,
  X,
  Sparkles
} from "lucide-react";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [savedName, setSavedName] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [roomCode, setRoomCode] = useState("");

  const startGame = () => {
    if (!savedName) {
      setShowProfile(true);
      return;
    }
    setShowPrivate(false);
  };

  const saveNickname = () => {
    const clean = nickname.trim();
    if (clean.length < 3 || clean.length > 16) return;
    setSavedName(clean);
    setShowProfile(false);
  };

  return (
    <main className="arena">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Skull size={27} />
          </div>
          <div>
            <span className="brand-name">SKULL ARENA</span>
            <span className="brand-sub">THE PIRATE CHALLENGE</span>
          </div>
        </div>

        <button
          className="profile-button"
          onClick={() => setShowProfile(true)}
        >
          <Users size={17} />
          {savedName || "Mon profil"}
        </button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="season-tag">
            <Sparkles size={14} />
            SAISON 01 — THE GOLDEN AGE
          </div>

          <h1>
            RULE THE
            <span>SEVEN SEAS</span>
          </h1>

          <p className="hero-description">
            Le destin des pirates se joue ici.
            Annonce tes plis, défie tes adversaires
            et deviens le maître des océans.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={startGame}>
              <Swords size={20} />
              ENTRER DANS L'ARÈNE
              <ChevronRight size={19} />
            </button>

            <button
              className="secondary-button"
              onClick={() => setShowPrivate(true)}
            >
              <Lock size={17} />
              REJOINDRE UN AMI
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>10</strong>
              <span>MANCHES</span>
            </div>
            <div>
              <strong>2–8</strong>
              <span>JOUEURS</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>TRÉSORS</span>
            </div>
          </div>
        </div>

        <div className="hero-emblem">
          <div className="emblem-ring">
            <div className="emblem-inner">
              <Crown size={34} />
              <Skull size={100} strokeWidth={1.2} />
              <span>SKULL KING</span>
              <small>MASTER OF THE SEAS</small>
            </div>
          </div>
          <div className="emblem-glow" />
        </div>
      </section>

      <section className="game-modes">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CHOOSE YOUR DESTINY</span>
            <h2>Choisis ton aventure</h2>
          </div>
          <Compass size={25} />
        </div>

        <div className="mode-grid">
          <button className="mode-card" onClick={startGame}>
            <div className="mode-icon">
              <Users size={28} />
            </div>
            <span className="mode-label">MULTIJOUEUR</span>
            <strong>Arène publique</strong>
            <p>Affronte des pirates du monde entier.</p>
            <span className="mode-link">JOUER <ChevronRight size={16} /></span>
          </button>

          <button className="mode-card featured" onClick={() => setShowPrivate(true)}>
            <div className="mode-icon">
              <Lock size={28} />
            </div>
            <span className="mode-label">ENTRE AMIS</span>
            <strong>Partie privée</strong>
            <p>Crée une salle et invite ton équipage.</p>
            <span className="mode-link">REJOINDRE <ChevronRight size={16} /></span>
          </button>

          <button className="mode-card" onClick={startGame}>
            <div className="mode-icon">
              <Trophy size={28} />
            </div>
            <span className="mode-label">COMPÉTITION</span>
            <strong>Classement</strong>
            <p>Gravis les rangs et gagne des trophées.</p>
            <span className="mode-link">DÉCOUVRIR <ChevronRight size={16} /></span>
          </button>
        </div>
      </section>

      <section className="bottom-panel">
        <div>
          <Ship size={22} />
          <div>
            <strong>TON ÉQUIPAGE T'ATTEND</strong>
            <span>Prépare-toi à prendre la mer.</span>
          </div>
        </div>
        <div className="online-status">
          <span className="status-dot" />
          ARÈNE EN PRÉPARATION
        </div>
      </section>

      <footer>
        <span>SKULL ARENA © 2026</span>
        <span>BUILT FOR PIRATES</span>
      </footer>

      {showProfile && (
        <div className="modal-overlay">
          <div className="modal">
            <button
              className="close-button"
              onClick={() => setShowProfile(false)}
            >
              <X />
            </button>
            <Skull size={42} />
            <span className="eyebrow">IDENTITÉ DU PIRATE</span>
            <h2>Quel est ton nom ?</h2>
            <p>Choisis ton surnom pour rejoindre l'équipage.</p>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ton pseudo..."
              maxLength={16}
            />
            <button
              className="primary-button modal-submit"
              disabled={nickname.trim().length < 3}
              onClick={saveNickname}
            >
              CONFIRMER MON IDENTITÉ
            </button>
          </div>
        </div>
      )}

      {showPrivate && (
        <div className="modal-overlay">
          <div className="modal">
            <button
              className="close-button"
              onClick={() => setShowPrivate(false)}
            >
              <X />
            </button>
            <Anchor size={42} />
            <span className="eyebrow">ÉQUIPAGE PRIVÉ</span>
            <h2>Rejoindre un équipage</h2>
            <p>Entre le code de la salle de ton ami.</p>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="CODE DE LA PARTIE"
              maxLength={8}
            />
            <button
              className="primary-button modal-submit"
              disabled={roomCode.trim().length < 4}
              onClick={startGame}
            >
              REJOINDRE
            </button>
            <small className="coming-soon">MULTIJOUEUR EN COURS DE DÉVELOPPEMENT</small>
          </div>
        </div>
      )}
    </main>
  );
}
