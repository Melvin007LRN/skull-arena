import { useState } from "react";
import { ArrowLeft, Crown, Skull, Swords, RotateCcw } from "lucide-react";
import { createSoloMatch, playSoloCard, submitSoloBid, startNextSoloRound, type SoloMatch } from "../game/solo";
import type { BotDifficulty, BotCardChoice } from "../game/bots";
import type { GameCard, Suit } from "../game/cards";

type Props = { onBack: () => void; username?: string };
const suitNames: Record<Suit, string> = { green: "Vert", purple: "Violet", yellow: "Jaune", black: "Noir" };
const iconFor = (card: GameCard) => card.type === "skull_king" ? "👑" : card.type === "pirate" ? "☠️" : card.type === "mermaid" ? "🧜" : card.type === "escape" ? "⚓" : card.type === "tigress" ? "🐅" : card.type === "joker" ? "🃏" : card.type === "number" ? String(card.value ?? card.selectableValue?.[0] ?? "?") : "✦";

export default function SoloGameScreen({ onBack, username }: Props) {
  const [botCount, setBotCount] = useState(3);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [match, setMatch] = useState<SoloMatch | null>(null);
  const [bid, setBid] = useState(0);
  const [selected, setSelected] = useState<GameCard | null>(null);
  const [tigressMode, setTigressMode] = useState<"pirate" | "escape">("pirate");
  const [chosenValue, setChosenValue] = useState<number | null>(null);
  const [chosenSuit, setChosenSuit] = useState<Suit>("green");

  const begin = () => {
    const game = createSoloMatch({ botCount, difficulty, username: username || "Capitaine" });
    setMatch(game);
    setBid(0);
    setSelected(null);
  };
  const playSelected = () => {
    if (!match || !selected) return;
    const next = playSoloCard(match, "solo-human", selected.id, {
      tigressMode: selected.type === "tigress" ? tigressMode : null,
      chosenValue: selected.selectableValue?.length ? chosenValue : null,
      chosenSuit: selected.type === "joker" ? chosenSuit : null,
    });
    setMatch(next);
    setSelected(null);
    setChosenValue(null);
  };

  if (!match) return (
    <main className="lobby-page solo-page">
      <header className="lobby-header"><button className="lobby-back" onClick={onBack}><ArrowLeft size={18}/> RETOUR</button><div className="lobby-brand"><Skull size={27}/><div><strong>SKULL ARENA</strong><span>MODE SOLO · LOCAL</span></div></div></header>
      <section className="lobby-content">
        <div className="lobby-eyebrow"><Crown size={16}/> DÉFI EN SOLO</div>
        <h1>Affronte les pirates</h1>
        <p className="lobby-description">Une partie locale sur ton appareil. Aucun salon, aucun bot sur le serveur, aucune modification des parties multijoueurs.</p>
        <div className="lobby-create-panel">
          <h2>TON ÉQUIPAGE</h2>
          <label>Nombre de bots</label>
          <select value={botCount} onChange={e=>setBotCount(Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} bot(s) · {n+1} joueurs au total</option>)}</select>
          <label>Difficulté</label>
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value as BotDifficulty)}><option value="easy">Matelot · Facile</option><option value="normal">Corsaire · Normal</option><option value="expert">Légende · Expert</option></select>
          <button className="lobby-primary" onClick={begin}><Swords size={18}/> LANCER LA PARTIE SOLO</button>
        </div>
      </section>
    </main>
  );

  const human = match.players[0];
  const humanTurn = match.phase === "playing" && match.players[match.turnIndex]?.isHuman;
  return (
    <main className="lobby-page solo-page">
      <header className="lobby-header"><button className="lobby-back" onClick={onBack}><ArrowLeft size={18}/> QUITTER</button><div className="lobby-brand"><Skull size={27}/><div><strong>SKULL ARENA</strong><span>SOLO · MANCHE {match.round}/{match.maxRounds}</span></div></div></header>
      <section className="lobby-content">
        <div className="lobby-eyebrow"><Crown size={16}/> {match.phase === "finished" ? "PARTIE TERMINÉE" : match.phase === "round-summary" ? "FIN DE MANCHE" : match.phase === "bidding" ? "ANNONCE DES PLIS" : "À L'ABORDAGE"}</div>
        <h1>{match.message}</h1>
        <div className="players-panel">
          <h2>ÉQUIPAGE ET SCORES</h2>
          {match.players.map((p,i)=><div className="player-row" key={p.id}><div className="player-avatar">{p.isHuman?<Crown size={18}/>:<Skull size={18}/>}</div><strong>{p.name}</strong><span>{p.bid === null ? "Mise en attente" : "Mise : "+p.bid}</span><span>{p.tricksWon} pli(s)</span><b>{p.totalScore} pts</b>{i===match.turnIndex&&match.phase==="playing"&&<span className="host-label">À JOUER</span>}</div>)}
        </div>
        {match.phase === "bidding" && <div className="lobby-create-panel"><h2>COMBIEN DE PLIS VAS-TU REMPORTER ?</h2><div className="join-code-row"><button onClick={()=>setBid(v=>Math.max(0,v-1))}>−</button><strong style={{fontSize:28}}>{bid}</strong><button onClick={()=>setBid(v=>Math.min(match.round,v+1))}>+</button></div><button className="lobby-primary" onClick={()=>setMatch(submitSoloBid(match,bid))}>VALIDER MON ANNONCE</button></div>}
        {match.phase === "playing" && <>
          <div className="players-panel"><h2>PLI {match.trickNumber} · CARTES POSÉES</h2>{match.plays.length===0?<p>Le pli n'a pas encore commencé.</p>:match.plays.map(p=><div className="player-row" key={p.playerId}><strong>{match.players.find(x=>x.id===p.playerId)?.name}</strong><span>{p.card.name}</span></div>)}</div>
          <div className="lobby-create-panel"><h2>TA MAIN · {human.hand.length} CARTE(S)</h2><div className="solo-hand">{human.hand.map(card=><button key={card.id} className={selected?.id===card.id?"game-card game-card-selected":"game-card"} onClick={()=>{setSelected(card);setChosenValue(card.selectableValue?.[0]??null);}}><span>{iconFor(card)}</span><strong>{card.name}</strong>{card.suit&&<small>{suitNames[card.suit]}</small>}</button>)}</div>
          {selected && <div className="selected-card-panel"><strong>{selected.name}</strong>
            {selected.type==="tigress"&&<div className="extension-toggle-actions"><button onClick={()=>setTigressMode("pirate")}>PIRATE</button><button onClick={()=>setTigressMode("escape")}>FUITE</button></div>}
            {!!selected.selectableValue?.length&&<div className="extension-toggle-actions">{selected.selectableValue.map(v=><button key={v} onClick={()=>setChosenValue(v)}>{v}</button>)}</div>}
            {selected.type==="joker"&&<select value={chosenSuit} onChange={e=>setChosenSuit(e.target.value as Suit)}><option value="green">Vert</option><option value="purple">Violet</option><option value="yellow">Jaune</option></select>}
            <button className="lobby-primary" disabled={!humanTurn} onClick={playSelected}>JOUER CETTE CARTE</button>
          </div>}
          {!humanTurn&&<p className="lobby-notice">Les pirates jouent automatiquement…</p>}
          </div>
        </>}
        {(match.phase==="round-summary"||match.phase==="finished")&&<div className="lobby-create-panel"><h2>RÉSULTATS</h2>{match.players.slice().sort((a,b)=>b.totalScore-a.totalScore).map((p,i)=><div className="player-row" key={p.id}><strong>#{i+1} {p.name}</strong><b>{p.totalScore} pts</b></div>)}{match.phase==="round-summary"?<button className="lobby-primary" onClick={()=>{setMatch(startNextSoloRound(match));setBid(0);}}>MANCHE SUIVANTE</button>:<button className="lobby-primary" onClick={begin}><RotateCcw size={18}/> REJOUER</button>}</div>}
      </section>
    </main>
  );
}
