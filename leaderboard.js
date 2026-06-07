// =======================================================
// WeCareBidar - CITIZEN LEADERBOARD CONTROLLER
// =======================================================

// 1. Supabase Initialization Configuration
const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWprY3BqeWRjaWN3c2dqZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjYxMTIsImV4cCI6MjA5NjMwMjExMn0.UlOP5KBZzCoEy4fUeytx7nEcz4Xv7F-rGhs5Mib6u9M";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// 2. DOM Elements
const statTreesSupported = document.getElementById('statTreesSupported');
const statWasteRemoved = document.getElementById('statWasteRemoved');
const statActiveCitizens = document.getElementById('statActiveCitizens');

const podiumContainer = document.getElementById('podiumContainer');
const leaderboardBody = document.getElementById('leaderboardBody');

// 5. Load Rankings and Stats
async function loadLeaderboardData() {
  try {
    // 1. Fetch all profiles
    const { data: profiles, error: pError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, avatar_url, district, created_at')
      .not('full_name', 'is', null);

    if (pError) throw pError;

    // 2. Fetch all approved submissions
    const { data: submissions, error: sError } = await supabaseClient
      .from('submissions')
      .select('id, user_id, category')
      .eq('status', 'approved');

    if (sError) throw sError;

    const approvedSubmissions = submissions || [];

    // Calculate aggregated submission counts per user ID
    const submissionCounts = {};
    approvedSubmissions.forEach(sub => {
      if (sub.user_id) {
        submissionCounts[sub.user_id] = (submissionCounts[sub.user_id] || 0) + 1;
      }
    });

    // Map profiles to include count details
    const rankedUsers = (profiles || []).map(p => {
      const approvedCount = submissionCounts[p.id] || 0;
      return {
        ...p,
        approvedCount: approvedCount,
        impactScore: approvedCount * 100
      };
    });

    // Sort ranked list: Action count descending, profile creation date ascending (tie-breaker)
    rankedUsers.sort((a, b) => {
      if (b.approvedCount !== a.approvedCount) {
        return b.approvedCount - a.approvedCount;
      }
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateA - dateB;
    });

    calculateGlobalStats(approvedSubmissions, profiles.length);
    renderPodium(rankedUsers);
    renderRankingsTable(rankedUsers);

  } catch (err) {
    console.error("Leaderboard load failed:", err);
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-error font-semibold">
          Error loading rankings: ${err.message || 'Database connection error.'}
        </td>
      </tr>
    `;
  }
}

// Compute statistics counts and format waste tons
function calculateGlobalStats(submissions, activeCitizens) {
  const treeCount = submissions.filter(s => s.category === "Afforestation / Tree Plantation").length;
  const wasteCount = submissions.filter(s => s.category === "Waste & Plastic Eradication").length;

  const totalTrees = treeCount * 50;
  const totalWasteKg = wasteCount * 150;

  // Format waste nicely: if >= 1000kg show tons, else show kg
  let wasteFormatted = '';
  if (totalWasteKg >= 1000) {
    wasteFormatted = `${(totalWasteKg / 1000).toFixed(1)}T`;
  } else {
    wasteFormatted = `${totalWasteKg.toLocaleString()} kg`;
  }

  animateCounter(statTreesSupported, totalTrees);
  animateCounterText(statWasteRemoved, wasteFormatted, totalWasteKg);
  animateCounter(statActiveCitizens, activeCitizens);
}

// 6. Dynamic Rankings Renderers
function renderPodium(rankedUsers) {
  podiumContainer.innerHTML = '';

  if (rankedUsers.length === 0) {
    podiumContainer.innerHTML = `
      <div class="glass-card p-12 text-center col-span-full rounded-2xl break-inside-avoid w-full">
        <span class="material-symbols-outlined text-5xl text-primary/30 mb-4">groups</span>
        <h4 class="font-headline-md text-headline-md text-primary">No Active Citizens Yet</h4>
        <p class="text-on-surface-variant text-sm mt-2">Become the first rebel contributor to join the Hall of Fame!</p>
      </div>
    `;
    return;
  }

  // Construct left-to-right podium cards order: 2nd place, 1st place, 3rd place
  const slots = [];
  
  // 2nd Place (銀)
  if (rankedUsers.length >= 2) {
    slots.push({ user: rankedUsers[1], rank: 2 });
  }
  // 1st Place (金)
  if (rankedUsers.length >= 1) {
    slots.push({ user: rankedUsers[0], rank: 1 });
  }
  // 3rd Place (銅)
  if (rankedUsers.length >= 3) {
    slots.push({ user: rankedUsers[2], rank: 3 });
  }

  // Generate podium cards
  slots.forEach(slot => {
    const user = slot.user;
    const rank = slot.rank;
    const avatar = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.full_name)}`;
    const ecoTitle = getEcoRankName(user.approvedCount);

    const card = document.createElement('div');
    
    // Assign custom styling classes based on podium position
    let orderClass = '';
    let podiumStyle = '';
    let rankBadge = '';
    let avatarSize = '';

    if (rank === 1) {
      orderClass = 'order-1 md:order-2';
      podiumStyle = 'podium-1st border-tertiary-container/30 bg-tertiary-fixed/5 py-10 md:py-12 md:-translate-y-4';
      avatarSize = 'w-24 h-24 md:w-28 md:h-28';
      rankBadge = `
        <div class="bg-tertiary-container text-on-tertiary-container p-2 rounded-full absolute -top-4 -right-2 border-2 border-white shadow-md flex items-center justify-center">
          <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
        </div>
      `;
    } else if (rank === 2) {
      orderClass = 'order-2 md:order-1';
      podiumStyle = 'border-slate-300/40 bg-slate-50/10 py-8';
      avatarSize = 'w-20 h-20 md:w-24 md:h-24';
      rankBadge = `
        <div class="bg-slate-400 text-white p-1.5 rounded-full absolute -top-3 -right-1 border-2 border-white shadow-md flex items-center justify-center">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
        </div>
      `;
    } else {
      orderClass = 'order-3 md:order-3';
      podiumStyle = 'border-amber-700/30 bg-amber-500/5 py-8';
      avatarSize = 'w-18 h-18 md:w-20 md:h-20';
      rankBadge = `
        <div class="bg-amber-700 text-white p-1.5 rounded-full absolute -top-3 -right-1 border-2 border-white shadow-md flex items-center justify-center">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
        </div>
      `;
    }

    card.className = `glass-card rounded-2xl p-6 ${podiumStyle} ${orderClass} relative flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.02]`;
    
    card.innerHTML = `
      <div class="relative mb-4">
        <div class="${avatarSize} rounded-full overflow-hidden border-4 border-surface-container-highest shadow-md">
          <img src="${avatar}" class="w-full h-full object-cover" alt="Profile avatar">
        </div>
        ${rankBadge}
      </div>
      <h3 class="font-headline-md text-[18px] md:text-xl font-bold text-on-surface truncate max-w-[180px]">${user.full_name}</h3>
      <p class="font-label-caps text-[10px] text-secondary tracking-wider mt-1">${user.district || 'Bidar'}</p>
      
      <div class="mt-4 bg-primary/5 border border-primary/10 rounded-full px-4 py-1.5 font-label-caps text-[10px] text-primary font-bold">
        ${ecoTitle}
      </div>

      <div class="mt-6 flex justify-between w-full border-t border-primary/5 pt-4 text-xs font-semibold">
        <div class="text-left text-on-surface-variant">
          <div>Verified Actions</div>
          <div class="text-[16px] font-bold text-primary mt-1">${user.approvedCount}</div>
        </div>
        <div class="text-right text-on-surface-variant">
          <div>Impact Score</div>
          <div class="text-[16px] font-bold text-tertiary mt-1">${user.impactScore}</div>
        </div>
      </div>
    `;

    podiumContainer.appendChild(card);
  });
}

function renderRankingsTable(rankedUsers) {
  leaderboardBody.innerHTML = '';

  // Users from rank 4 and below display in the table
  const tableUsers = rankedUsers.length > 3 ? rankedUsers.slice(3) : [];

  if (tableUsers.length === 0 && rankedUsers.length <= 3) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-on-surface-variant italic">
          No additional ranks yet. Submit verified actions to expand the collective!
        </td>
      </tr>
    `;
    return;
  }

  tableUsers.forEach((user, index) => {
    const rank = index + 4; // Starts from 4th place
    const avatar = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.full_name)}`;
    const ecoTitle = getEcoRankName(user.approvedCount);

    const row = document.createElement('tr');
    row.className = "hover:bg-primary-container/5 transition-colors";
    
    row.innerHTML = `
      <td class="py-4 px-6 text-center font-bold text-on-surface-variant font-stat-display text-[16px]">
        #${rank}
      </td>
      <td class="py-4 px-6 font-semibold">
        <div class="flex items-center gap-3">
          <img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-primary/5" alt="Avatar">
          <span class="truncate max-w-[200px]">${user.full_name}</span>
        </div>
      </td>
      <td class="py-4 px-6 text-on-surface-variant">
        ${user.district || 'Bidar'}
      </td>
      <td class="py-4 px-6">
        <span class="text-xs px-2.5 py-1 rounded bg-surface-container-high border border-primary/5 text-primary-container font-semibold">
          ${ecoTitle}
        </span>
      </td>
      <td class="py-4 px-6 text-center font-bold text-primary">
        ${user.approvedCount}
      </td>
      <td class="py-4 px-6 text-right font-bold text-tertiary font-stat-display text-[16px]">
        ${user.impactScore}
      </td>
    `;

    leaderboardBody.appendChild(row);
  });
}

// Helper: Rank Names mapping
function getEcoRankName(uploads) {
  if (uploads <= 1) return "Eco Recruit (L1)";
  if (uploads === 2) return "Eco Defender (L2)";
  if (uploads <= 4) return "Eco Specialist (L3)";
  if (uploads <= 6) return "Eco Captain (L4)";
  if (uploads <= 8) return "Eco Commander (L5)";
  if (uploads <= 10) return "Eco Leader (L6)";
  return "Eco Warrior (L7)";
}

// 7. Stats Counter Animations
function animateCounter(element, endValue) {
  if (!element) return;
  const start = 0;
  const duration = 1200; // 1.2s
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    element.innerHTML = Math.floor(progress * (endValue - start) + start).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerHTML = endValue.toLocaleString();
    }
  };
  window.requestAnimationFrame(step);
}

function animateCounterText(element, finalString, numericEnd) {
  if (!element) return;
  const start = 0;
  const duration = 1200; // 1.2s
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const val = Math.floor(progress * (numericEnd - start) + start);
    
    if (numericEnd >= 1000) {
      element.innerHTML = `${(val / 1000).toFixed(1)}T`;
    } else {
      element.innerHTML = `${val.toLocaleString()} kg`;
    }
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerHTML = finalString;
    }
  };
  window.requestAnimationFrame(step);
}

// Initialization Sequence
async function initLeaderboard() {
  await loadLeaderboardData();
}

initLeaderboard();
