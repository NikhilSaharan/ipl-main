/* eslint-disable no-unused-vars */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { INITIAL_TEAMS } from './data/teams';
import { calculatePoints } from './utils/scoring';
import { RefreshCw, Zap, Trophy, CheckCircle2, Star, Shield } from 'lucide-react';

const API_KEYS = [
  "a5bf3381-0a32-4862-acf4-5f52212682af",
  "faad77ac-7dbc-4dc1-b180-8db6bbfb5df8",
  "f222370e-2beb-4af8-9941-c435b5310964",
  "538d0d08-0175-4e24-b9d5-d72af0e83d23"

];
let currentKeyIndex = 0;
const getApiKey = () => API_KEYS[currentKeyIndex % API_KEYS.length];
const rotateKey = () => { currentKeyIndex++; console.log(`🔑 Rotated to API key #${(currentKeyIndex % API_KEYS.length) + 1}`); };

const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

const NAME_MAP = {
  "Sheheferd": "Romario Shepherd",
  "Rizvi": "Sameer Rizvi",
  "Jurel": "Dhruv Jurel",
  "Vaibhav arorra": "Vaibhav Arora",
  "Nitinsh Rana": "Nitish Rana",
  "Surya": "Suryakumar Yadav",
  "Phil Salt": "Philip Salt",
  "Phill Salt": "Philip Salt",
  "PS Salt": "Philip Salt",
  "V Kohli": "Virat Kohli",
  "RG Sharma": "Rohit Sharma",
  "H Pandya": "Hardik Pandya",
  "JJ Bumrah": "Jasprit Bumrah",
  "M Siraj": "Mohammed Siraj",
  "M Shami": "Mohammed Shami",
  "A Singh": "Arshdeep Singh",
  "Y Chahal": "Yuzvendra Chahal",
  "K Yadav": "Kuldeep Yadav",
  "RA Jadeja": "Ravindra Jadeja",
  "AR Patel": "Axar Patel",
  "Varun Chakravarthy": "Varun Chakaravarthy",
  "I Kishan": "Ishan Kishan",
  "S Samson": "Sanju Samson",
  "RR Pant": "Rishabh Pant",
  "K Rahul": "KL Rahul",
  "JC Buttler": "Jos Buttler",
  "N Pooran": "Nicholas Pooran",
  "S Gill": "Shubman Gill",
  "RD Gaikwad": "Ruturaj Gaikwad",
  "YBK Jaiswal": "Yashasvi Jaiswal",
  "SK Yadav": "Suryakumar Yadav",
  "T Varma": "Tilak Varma",
  "SS Iyer": "Shreyas Iyer",
  "D Padikkal": "Devdutt Padikkal",
  "R Patidar": "Rajat Patidar",
  "B Sudharsan": "Sai Sudharsan",
  "AK Markram": "Aiden Markram",
  "TM Head": "Travis Head",
  "MR Marsh": "Mitchell Marsh",
  "M Jansen": "Marco Jansen",
  "S Dube": "Shivam Dube",
  "A Sharma": "Abhishek Sharma",
  "Nitish Reddy": "Nitish Kumar Reddy",
  "HE Klaasen": "Heinrich Klaasen",
  "V Sooryavanshi": "Vaibhav Sooryavanshi",
  "P Krishna": "Prasidh Krishna",
};

const normalizeName = (rawName) => {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  return NAME_MAP[trimmed] || trimmed;
};

// Extract player name from API - handles both object {name: "..."} and string "..."
const extractName = (playerField) => {
  if (!playerField) return null;
  if (typeof playerField === 'string') return playerField;
  return playerField.name || playerField.Name || null;
};

// Common last names in cricket - don't fuzzy match on these alone
const COMMON_LAST_NAMES = ['singh', 'sharma', 'kumar', 'patel', 'yadav', 'khan', 'iyer', 'reddy', 'nair', 'chahar', 'pandya', 'chahal'];

// Fuzzy match: try multiple strategies to find player stats
const fuzzyFindStats = (statsMap, playerName) => {
  // 1. Direct match
  if (statsMap[playerName]) return statsMap[playerName];

  // 2. Normalized match
  const normalized = normalizeName(playerName);
  if (statsMap[normalized]) return statsMap[normalized];

  // 3. Case-insensitive match
  const lowerName = playerName.toLowerCase();
  for (const key of Object.keys(statsMap)) {
    if (key.toLowerCase() === lowerName) return statsMap[key];
  }

  // 4. Smart name matching
  const nameParts = playerName.split(' ');
  const firstName = nameParts[0].toLowerCase();
  const lastName = nameParts[nameParts.length - 1].toLowerCase();
  const isCommonLastName = COMMON_LAST_NAMES.includes(lastName);

  const matches = Object.keys(statsMap).filter(key => {
    const keyParts = key.split(' ');
    const keyLast = keyParts[keyParts.length - 1].toLowerCase();
    const keyFirst = keyParts[0].toLowerCase();

    if (keyLast !== lastName) return false;

    // For common last names, FULL first name must match
    if (isCommonLastName) {
      return keyFirst === firstName;
    }

    // For unique last names, just last name match is enough if only 1 result
    return true;
  });

  if (matches.length === 1) {
    console.log(`🔗 Fuzzy matched: "${playerName}" → "${matches[0]}"`);
    return statsMap[matches[0]];
  }

  // 5. For common last names with no full-name match, try first 3+ chars
  if (isCommonLastName && matches.length === 0) {
    const prefix = firstName.slice(0, 3);
    const prefixMatches = Object.keys(statsMap).filter(key => {
      const keyParts = key.split(' ');
      const keyLast = keyParts[keyParts.length - 1].toLowerCase();
      const keyFirst = keyParts[0].toLowerCase();
      return keyLast === lastName && keyFirst.startsWith(prefix);
    });
    if (prefixMatches.length === 1) {
      console.log(`🔗 Prefix matched: "${playerName}" → "${prefixMatches[0]}"`);
      return statsMap[prefixMatches[0]];
    }
  }

  return null;
};

// Also fuzzy find in playerToIPLTeam map
const fuzzyFindTeam = (playerToIPLTeam, playerName) => {
  const normalized = normalizeName(playerName);
  if (playerToIPLTeam[normalized]) return playerToIPLTeam[normalized];
  if (playerToIPLTeam[playerName]) return playerToIPLTeam[playerName];

  const lowerName = playerName.toLowerCase();
  for (const key of Object.keys(playerToIPLTeam)) {
    if (key.toLowerCase() === lowerName) return playerToIPLTeam[key];
  }

  const nameParts = playerName.split(' ');
  const firstName = nameParts[0].toLowerCase();
  const lastName = nameParts[nameParts.length - 1].toLowerCase();
  const isCommonLastName = COMMON_LAST_NAMES.includes(lastName);

  const matches = Object.keys(playerToIPLTeam).filter(key => {
    const keyParts = key.split(' ');
    const keyLast = keyParts[keyParts.length - 1].toLowerCase();
    const keyFirst = keyParts[0].toLowerCase();
    if (keyLast !== lastName) return false;
    if (isCommonLastName) return keyFirst === firstName;
    return true;
  });
  if (matches.length === 1) return playerToIPLTeam[matches[0]];

  return null;
};

function App() {
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('ipl_fantasy_v3');
    return saved ? JSON.parse(saved) : INITIAL_TEAMS.map(t => ({
      ...t,
      totalPoints: 0,
      syncedMatches: [],
      players: t.players.map(p => ({ ...p, points: 0 }))
    }));
  });

  const [loading, setLoading] = useState(false);
  const [errorMatches, setErrorMatches] = useState([]);
  const [syncStatus, setSyncStatus] = useState("");
  const [availableMatches, setAvailableMatches] = useState([]); // ✅ NEW

  useEffect(() => {
    localStorage.setItem('ipl_fantasy_v3', JSON.stringify(teams));
  }, [teams]);

  const buildPlayerStatsMap = (scorecard) => {
    const statsMap = {};

    const ensure = (rawName) => {
      const name = normalizeName(rawName);
      if (!name) return null;
      if (!statsMap[name]) statsMap[name] = { played: true };
      return name;
    };

    const addCatch = (rawName) => {
      const name = ensure(rawName);
      if (name) statsMap[name].catches = (statsMap[name].catches || 0) + 1;
    };

    const addStumping = (rawName) => {
      const name = ensure(rawName);
      if (name) statsMap[name].stumping = (statsMap[name].stumping || 0) + 1;
    };

    scorecard.forEach(inning => {
      console.log(`📋 Processing inning: "${inning.inning}"`);

      if (inning.batting) {
        inning.batting.forEach(b => {
          const rawBatsmanName = extractName(b.batsman);
          const batsmanName = ensure(rawBatsmanName);
          if (!batsmanName) {
            console.warn(`⚠️ Could not extract batsman name from:`, b.batsman);
            return;
          }

          statsMap[batsmanName].runs = (statsMap[batsmanName].runs || 0) + (b.r || 0);
          statsMap[batsmanName].balls = (statsMap[batsmanName].balls || 0) + (b.b || 0);
          statsMap[batsmanName].fours = (statsMap[batsmanName].fours || 0) + (b['4s'] || 0);
          statsMap[batsmanName].sixes = (statsMap[batsmanName].sixes || 0) + (b['6s'] || 0);
          if ((b.r === 0 || b.r === "0") && b.dismissal) statsMap[batsmanName].isDuck = true;

          const dismissal = (b.dismissal || '').toLowerCase().trim();
          const dismissalText = (b['dismissal-text'] || '').toLowerCase();

          // LBW or Bowled bonus for bowler
          if (dismissal === 'lbw' || dismissal === 'bowled') {
            const bowlerName = ensure(extractName(b.bowler));
            if (bowlerName) {
              statsMap[bowlerName].lbw_or_bowled = (statsMap[bowlerName].lbw_or_bowled || 0) + 1;
            }
          }

          // Catch credit
          if (dismissal === 'catch' || dismissal === 'caught') {
            const catcherRaw = extractName(b.catcher) || extractName(b.fielder);
            if (catcherRaw) {
              addCatch(catcherRaw);
            } else if (b['dismissal-text']) {
              const text = b['dismissal-text'];
              const m = text.match(/^c\s+(.+?)\s+b/i);
              if (m && m[1]) {
                console.log(`🛠 Parsed catcher from text: ${m[1]}`);
                addCatch(m[1]);
              }
            }
          } else if ((dismissal === 'stumped' || dismissal === 'stumping')) {
            const stumperRaw = extractName(b.catcher) || extractName(b.fielder);
            if (stumperRaw) addStumping(stumperRaw);
          } else if (
            dismissal === 'caught and bowled' ||
            dismissalText.startsWith('c&b') ||
            dismissalText.startsWith('c and b')
          ) {
            const bowlerRaw = extractName(b.bowler);
            if (bowlerRaw) addCatch(bowlerRaw);
          } else if (dismissal === 'run out' || dismissal === 'runout' || dismissal === 'run-out') {
            // Try to credit run out fielder
            const fielderRaw = extractName(b.catcher) || extractName(b.fielder);
            if (fielderRaw) {
              const fielderName = ensure(fielderRaw);
              if (fielderName) {
                // Check if direct or indirect from dismissal text
                if (dismissalText.includes('direct')) {
                  statsMap[fielderName].runout_direct = (statsMap[fielderName].runout_direct || 0) + 1;
                } else {
                  statsMap[fielderName].runout_indirect = (statsMap[fielderName].runout_indirect || 0) + 1;
                }
              }
            }
          }
        });
      }

      if (inning.bowling) {
        inning.bowling.forEach(bw => {
          const rawBowlerName = extractName(bw.bowler);
          const name = ensure(rawBowlerName);
          if (!name) {
            console.warn(`⚠️ Could not extract bowler name from:`, bw.bowler);
            return;
          }
          statsMap[name].wickets = (statsMap[name].wickets || 0) + (bw.w || 0);
          statsMap[name].overs = (statsMap[name].overs || 0) + (parseFloat(bw.o) || 0);
          statsMap[name].runs_conceded = (statsMap[name].runs_conceded || 0) + (bw.r || 0);
          // Maiden overs
          if (bw.m) statsMap[name].maiden = (statsMap[name].maiden || 0) + (bw.m || 0);
          // Dot balls
          if (bw.dots || bw.d) statsMap[name].dots = (statsMap[name].dots || 0) + (bw.dots || bw.d || 0);
        });
      }

    });

    return statsMap;
  };

  // ✅ FETCH MATCH LIST ONLY
  const syncTournament = async () => {
    if (loading) return;
    setLoading(true);
    setSyncStatus("Fetching Matches...");

    try {
      const res = await axios.get(
        `https://api.cricapi.com/v1/series_info?apikey=${getApiKey()}&id=${IPL_SERIES_ID}`
      );

      const apiData = res.data;

      if (!apiData || apiData.status !== "success" || !apiData.data) {
        console.error("❌ API FAIL:", apiData);
        rotateKey();
        alert("API limit over — rotated to next key. Try again!");
        return;
      }

      const allMatches = apiData.data.matchList || [];
      const alreadySynced = teams[0].syncedMatches || [];
      const failedMatches = errorMatches || [];

      const getMatchNo = (name) => {
        const match = name.match(/(\d+)(st|nd|rd|th)\sMatch/i);
        return match ? parseInt(match[1]) : 0;
      };

      const pending = allMatches
        .filter(m =>
          m.matchEnded &&
          (
            !alreadySynced.includes(m.id) ||
            failedMatches.includes(m.id)
          ) &&
          getMatchNo(m.name) > 70
        )
        .sort((a, b) => {
          return getMatchNo(a.name) - getMatchNo(b.name);
        })

      setAvailableMatches(pending);

      if (pending.length === 0) alert("All matches already synced!");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSyncStatus("");
    }
  };

  // ✅ SINGLE MATCH SYNC
  const syncSingleMatch = async (match, selectedTeam = "ALL") => {
    try {
      setLoading(true);
      setSyncStatus(`Syncing ${match.name}`);

      const res = await axios.get(
        `https://api.cricapi.com/v1/match_scorecard?apikey=${getApiKey()}&id=${match.id}`
      );

      const scorecardData = res.data?.data;
      console.log(`📊 Raw scorecard response for ${match.name}:`, res.data);

      if (!scorecardData || !scorecardData.scorecard || !Array.isArray(scorecardData.scorecard) || scorecardData.scorecard.length === 0) {
        console.error(`❌ No scorecard data for ${match.name}. Response:`, res.data);
        if (res.data?.status !== 'success') {
          rotateKey();
          console.log('🔑 Rotated API key due to failure');
        }
        setErrorMatches(prev => [...prev, match.id]);
        return;
      }

      const statsMap = buildPlayerStatsMap(scorecardData.scorecard);

      console.log(`📊 StatsMap keys (${Object.keys(statsMap).length} players):`, Object.keys(statsMap));
      console.log(`📊 Full StatsMap:`, JSON.parse(JSON.stringify(statsMap)));

      // Build set of players who actually played in this match
      const teamAFull = match.teams[0].toLowerCase();
      const teamBFull = match.teams[1].toLowerCase();

      // Map each player in statsMap to their IPL team
      const playerToIPLTeam = {};

      scorecardData.scorecard.forEach(inning => {
        const inningTeam = (inning.inning || '').toLowerCase();
        // This inning's batting team
        const isTeamA = inningTeam.includes(teamAFull);
        const isTeamB = inningTeam.includes(teamBFull);

        console.log(`🏏 Inning: "${inning.inning}" | isTeamA(${teamAFull}): ${isTeamA} | isTeamB(${teamBFull}): ${isTeamB}`);

        if (!isTeamA && !isTeamB) {
          console.error(`❌ INNING NAME MISMATCH! "${inning.inning}" doesn't contain "${teamAFull}" or "${teamBFull}"`);
        }

        // Batsmen belong to the batting team of this inning
        inning.batting?.forEach(b => {
          const rawName = extractName(b.batsman);
          const name = normalizeName(rawName);
          if (!name) return;
          if (isTeamA) playerToIPLTeam[name] = teamAFull;
          else if (isTeamB) playerToIPLTeam[name] = teamBFull;
        });

        // Bowlers belong to the OPPOSITE team
        inning.bowling?.forEach(bw => {
          const rawName = extractName(bw.bowler);
          const name = normalizeName(rawName);
          if (!name) return;
          if (isTeamA) playerToIPLTeam[name] = teamBFull;
          else if (isTeamB) playerToIPLTeam[name] = teamAFull;
        });
      });

      console.log(`🏷️ PlayerToIPLTeam:`, playerToIPLTeam);

      const updated = teams.map(team => {
        let pts = 0;
        const players = team.players.map(p => {
          // Use fuzzy matching to find stats
          const stats = fuzzyFindStats(statsMap, p.name);

          // Team filter
          if (selectedTeam !== "ALL") {
            const selected = selectedTeam.toLowerCase();
            const playerTeam = fuzzyFindTeam(playerToIPLTeam, p.name);

            // Check if player belongs to selected team (strict equality)
            const belongsToSelected = playerTeam && playerTeam === selected;
            if (!belongsToSelected) {
              if (stats) {
                console.log(`⏭️ ${p.name}: has stats but filtered out (playerTeam=${playerTeam}, selected=${selected})`);
              }
              return p;
            }
          }

          if (!stats) {
            console.log(`⚪ ${p.name}: no stats found in this match (didn't play)`);
            return p;
          }

          const newPts = calculatePoints(stats, p.role, true, p.isCaptain, p.isVC);
          pts += newPts;
          console.log(`✅ ${p.name}: +${newPts} pts (runs=${stats.runs||0}, wkts=${stats.wickets||0}, catches=${stats.catches||0}, overs=${stats.overs||0})`);

          return { ...p, points: (p.points || 0) + newPts };
        });

        return {
          ...team,
          totalPoints: team.totalPoints + pts,
          players,
          syncedMatches: Array.from(
            new Set([...(team.syncedMatches || []), match.id])
          )
        };
      });

      setTeams(updated);

    } catch (e) {
      console.error(e);
      setErrorMatches(prev => [...prev, match.id]);
    } finally {
      setLoading(false);
      setSyncStatus("");
    }
  };
  const retryMatch = async (match) => {
    setErrorMatches(prev => prev.filter(id => id !== match.id));
    await syncSingleMatch(match, "ALL");
  };

  const resetAll = () => {
    const fresh = INITIAL_TEAMS.map(t => ({
      ...t,
      totalPoints: 0,
      syncedMatches: [],
      players: t.players.map(p => ({ ...p, points: 0 }))
    }));
    setTeams(fresh);
    localStorage.removeItem('ipl_fantasy_v3');
  };

  const sortedTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* HEADER SAME */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 mb-10 shadow-2xl backdrop-blur-md">
          <div>
            <h1 className="text-5xl font-black italic text-yellow-500">IPL 2026 TRACKER</h1>
          </div>
          <div className="mt-8 md:mt-0 flex flex-col items-center gap-3">
            <button onClick={syncTournament} disabled={loading}
              className="bg-white text-black px-10 py-5 rounded-[2rem] font-black flex gap-3">
              {loading ? "Loading..." : "SYNC TOURNAMENT"}
            </button>
            {syncStatus && <p className="text-yellow-500 text-xs">{syncStatus}</p>}
            <button onClick={resetAll}>Reset</button>
          </div>
        </header>

        {/* ✅ MATCH LIST */}
        {availableMatches.length > 0 && (
          <div className="mb-10 space-y-2">
            {availableMatches.map(match => {
              const teamsFromMatch = match.name.split(" vs ");

              const teamA = match.teams[0];
              const teamB = match.teams[1];

              return (

                <div key={match.id} className="flex justify-between bg-zinc-900 p-3 rounded-xl">

                  <span>{match.name}</span>
                  {teams[0].syncedMatches?.includes(match.id) ? (
                    <span className="text-green-500 font-bold">Synced</span>
                  ) : errorMatches.includes(match.id) ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-red-500 font-bold">Limit Over</span>
                      <button
                        onClick={() => retryMatch(match)}
                        className="text-blue-400 text-xs underline"
                      >
                        Refresh
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => syncSingleMatch(match, "ALL")}
                        className="text-yellow-400 text-xs"
                      >
                        ALL
                      </button>

                      <button
                        onClick={() => syncSingleMatch(match, teamA)}
                        className="text-green-400 text-xs"
                      >
                        {teamA}
                      </button>

                      <button
                        onClick={() => syncSingleMatch(match, teamB)}
                        className="text-blue-400 text-xs"
                      >
                        {teamB}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TEAM UI SAME */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teams.map((team, i) => (
            <div key={i} className="group bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden transition-all hover:border-yellow-500/30 shadow-lg">

              <div className="p-8 bg-zinc-800/50 flex justify-between items-center border-b border-white/5 group-hover:bg-zinc-800 transition-colors">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter">{team.owner}</h2>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                    {team.syncedMatches?.length || 0} Matches Synced
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-yellow-500 uppercase">Points</p>
                  <p className="text-3xl font-mono font-black">{team.totalPoints}</p>
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[450px] overflow-y-auto bg-black/20">
                {team.players.map((p, j) => (
                  <div key={j} className="flex justify-between items-center p-3 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800 transition-all">

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-300 group-hover:text-white">{p.name}</span>

                        {p.isCaptain && (
                          <span className="bg-yellow-500 text-black text-[8px] px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5">
                            <Star size={8} fill="black" /> C
                          </span>
                        )}

                        {p.isVC && (
                          <span className="bg-zinc-400 text-black text-[8px] px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5">
                            <Shield size={8} fill="black" /> VC
                          </span>
                        )}
                      </div>

                      <span className="text-[9px] uppercase font-black text-zinc-600 tracking-wider">
                        {p.role}
                      </span>
                    </div>

                    <span className="text-lg font-mono font-black text-yellow-500">
                      {p.points}
                    </span>

                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;

