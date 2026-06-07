// =======================================================
// WeCareBidar - COMMUNITY IMPACT FEED CONTROLLER
// =======================================================

// 1. Firebase Initialization Check
if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
  console.warn("⚠️ Firebase objects not found. Checking if loaded asynchronously...");
}

// 2. DOM Elements
const counterActionsApproved = document.getElementById('counterActionsApproved');
const counterWasteRemoved = document.getElementById('counterWasteRemoved');
const counterTreesPlanted = document.getElementById('counterTreesPlanted');

const feedGrid = document.getElementById('feedGrid');
const filterBar = document.getElementById('filterBar');

// 3. State Management
let allSubmissions = [];

const FALLBACK_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB4WHl4DbEoUytFX6fgy3AbbL8hvoNSkfpeqvyAFqi5VzvqJvKSeRTcnpgVxxxh_uo6XdMYyFXVqOMttKx46_f6Bkta2N5DdC1bK-CGk0OR2RnNUtTHKNGW004VMgG4JE88trBTxz9UgkrUoFGYazpSMwlbmV2CEC6mLaRW_gF9bkek1ixfztuwmpIIxu0hAayAoh149rweUDvLV1SVRJSxpIX2hEg1UR0XAFuUpysOu9F6icQcjso2URueF5b5p3QVpuhaxjSkNqA", // Planting
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdvI4J5KODJSiRIOqTqxvYbsiXm38oUDuI_4ty7Upv26jMZc18EROjy7arlz0XP2DyybobCuhyleI7J-A1K0jqEAJLiwpe5oSdXVgcMtkqQKKElUwJxCv1B3qZ95VeDtwdLZWKDGI1Mg9_w1PEKQsLLBO19a6VhChSFHm_nZ0vi4GNT7i6BoVjFTbaR4yp41c19H0-NI87xzkbi6WYs3BDmD4wzuAONfkIsCV5dLWMuxGAe0calEbPVdYIIdLt4F5XTQ3c846ttSU", // River cleanup
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAWYkrw2rAlk-KKHp7aq3dn_oo4nxFfbfZ-szCWPYL2yljyzn4CSwfrKFo9HCBZuX40qYhpezmZHCNyWdakDpxLuVpP-Al4tBifj8_D44MSiuj8EOK3O1UhIqINVNny-7uQ9nvxaEImlcQZqi8uXwnxqQ-aY3LZSmz_JNW4Siwoo49CnbMqP0dvnEGUiE7Im85XgmlInru1etZpfk9qxhn4b85MwvBq7Jb5anz_T1bsw7g5Fiyvy8IEbyuaUYaqKYU2BOeSeqaXRjE"  // Nature Bird
];

// 4. Data Hydration & Stats Calculations
async function loadFeedData() {
  try {
    // Retrieve approved submissions from Firestore
    const querySnapshot = await db.collection('submissions')
      .where('status', '==', 'approved')
      .get();

    const submissions = [];
    const userIds = new Set();

    querySnapshot.forEach(doc => {
      const data = doc.data();
      let created_at = data.created_at;
      if (created_at && typeof created_at.toDate === 'function') {
        created_at = created_at.toDate().toISOString();
      }
      submissions.push({
        id: doc.id,
        ...data,
        created_at: created_at || new Date().toISOString()
      });
      if (data.user_id) {
        userIds.add(data.user_id);
      }
    });

    // In-memory sort by created_at desc (avoids Firestore index requirement)
    submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Fetch profiles for the userIds
    const profiles = {};
    if (userIds.size > 0) {
      const chunks = Array.from(userIds);
      const profilePromises = chunks.map(uid => db.collection('profiles').doc(uid).get());
      const profileDocs = await Promise.all(profilePromises);
      profileDocs.forEach(pDoc => {
        if (pDoc.exists) {
          profiles[pDoc.id] = pDoc.data();
        }
      });
    }

    // Attach profile info to each submission
    submissions.forEach(sub => {
      if (sub.user_id && profiles[sub.user_id]) {
        sub.profiles = {
          id: sub.user_id,
          full_name: profiles[sub.user_id].full_name,
          avatar_url: profiles[sub.user_id].avatar_url
        };
      }
    });

    allSubmissions = submissions;

    calculateMovementStats();
    renderFeedGrid("all");

  } catch (err) {
    console.error("Failed to load feed data:", err);
    feedGrid.innerHTML = `
      <div class="glass-card p-12 text-center col-span-full rounded-2xl break-inside-avoid">
        <span class="material-symbols-outlined text-5xl text-error mb-4">error</span>
        <h4 class="font-headline-md text-headline-md text-error">Failed to Load Feed</h4>
        <p class="text-on-surface-variant text-sm mt-2">There was an issue connecting to the environmental registry database. Please try refreshing.</p>
      </div>
    `;
  }
}

// Compute dynamic stats and trigger animate rise
function calculateMovementStats() {
  const actionsCount = allSubmissions.length;
  
  const wasteSubmissionsCount = allSubmissions.filter(s => s.category === "Waste & Plastic Eradication").length;
  const wasteRemoved = wasteSubmissionsCount * 150; // 150kg per action

  const treeSubmissionsCount = allSubmissions.filter(s => s.category === "Afforestation / Tree Plantation").length;
  const treesPlanted = treeSubmissionsCount * 50; // 50 trees per action

  counterActionsApproved.setAttribute('data-target', actionsCount);
  counterWasteRemoved.setAttribute('data-target', wasteRemoved);
  counterTreesPlanted.setAttribute('data-target', treesPlanted);

  animateCounter(counterActionsApproved, actionsCount);
  animateCounter(counterWasteRemoved, wasteRemoved);
  animateCounter(counterTreesPlanted, treesPlanted);
}

// 6. Masonry Feed Card Rendering
function renderFeedGrid(filterCategory = "all") {
  feedGrid.innerHTML = '';

  const filtered = filterCategory === "all" 
    ? allSubmissions 
    : allSubmissions.filter(sub => sub.category === filterCategory);

  if (filtered.length === 0) {
    feedGrid.innerHTML = `
      <div class="glass-card p-12 text-center col-span-full rounded-2xl break-inside-avoid w-full">
        <span class="material-symbols-outlined text-5xl text-primary/30 mb-4">nature_people</span>
        <h4 class="font-headline-md text-headline-md text-primary">No Campaigns Yet</h4>
        <p class="text-on-surface-variant text-sm mt-2">No approved actions under this category yet. Upload yours and start the movement!</p>
      </div>
    `;
    return;
  }

  filtered.forEach((sub, idx) => {
    const card = document.createElement('article');
    card.className = "break-inside-avoid relative rounded-xl overflow-hidden group bg-surface border border-primary/10 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.06)] transition-shadow duration-300 flex flex-col mb-gutter";

    const contributorName = sub.profiles?.full_name || "Anonymous Rebel";
    const contributorAvatar = sub.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(contributorName)}`;
    
    const dateText = new Date(sub.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Strip labels or notes prefix if needed to show clean text
    let displayNotes = sub.user_description || "";
    if (displayNotes.includes("Notes: ")) {
      displayNotes = displayNotes.split("Notes: ")[1].trim();
    } else {
      displayNotes = displayNotes.replace(/Campaign:.*?\n/i, '')
                                .replace(/Zone:.*?\n/i, '')
                                .replace(/Category:.*?\n/i, '')
                                .trim();
    }

    const iconName = getCategoryIconName(sub.category);
    const fallbackImage = getCategoryFallbackImage(sub.category, idx);

    let mediaMarkup = '';
    
    if (sub.video_url) {
      // Muted video that plays on hover
      mediaMarkup = `
        <div class="aspect-video relative overflow-hidden bg-secondary-container feed-video-container">
          <video class="w-full h-full object-cover" src="${sub.video_url}" muted loop playsinline></video>
          <!-- Play Icon Overlay -->
          <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
            <div class="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/50">
              <span class="material-symbols-outlined text-white text-[24px] icon-fill">play_arrow</span>
            </div>
          </div>
          <!-- Status Badge -->
          <div class="absolute top-3 left-3 bg-primary text-on-primary font-label-caps text-[10px] px-2 py-1 rounded-sm flex items-center gap-1 shadow-sm">
            <span class="material-symbols-outlined text-[12px]">check_circle</span>
            Active Storage Stream
          </div>
        </div>
      `;
    } else {
      // Video is deleted to maintain zero storage footprint
      mediaMarkup = `
        <div class="aspect-[4/3] relative overflow-hidden">
          <img alt="Environmental Impact" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="${fallbackImage}"/>
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
          <!-- Zero Footprint Badge -->
          <div class="absolute top-4 left-4 bg-tertiary-fixed text-on-tertiary-fixed font-label-caps text-[10px] px-3 py-1.5 rounded flex items-center gap-1.5 shadow-md">
            <span class="material-symbols-outlined text-[14px] icon-fill">campaign</span>
            0MB Footprint - Distributed
          </div>
          
          <div class="absolute bottom-4 left-4 right-4 text-white">
            <span class="inline-block px-2 py-0.5 bg-white/10 backdrop-blur-md rounded border border-white/20 font-label-caps text-[10px] text-white">
              Storage Purged
            </span>
          </div>
        </div>
      `;
    }

    // Impact Badge values depending on Category
    const impactBadge = getImpactValueText(sub);

    card.innerHTML = `
      ${mediaMarkup}
      <div class="p-6 flex-grow flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-2 text-primary mb-3">
            <span class="material-symbols-outlined text-[16px]">${iconName}</span>
            <span class="font-label-caps text-xs">${sub.category || 'Environmental Action'}</span>
          </div>
          
          <h3 class="font-headline-md text-lg text-on-surface mb-2 font-bold leading-snug">${sub.title || 'Untitled Campaign'}</h3>
          <p class="font-body-md text-sm text-on-surface-variant mb-6 line-clamp-3">${displayNotes || 'No notes left by contributor.'}</p>
        </div>
        
        <div>
          <div class="flex justify-between items-end border-t border-primary/5 pt-4 mt-2">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full overflow-hidden border border-primary/10 bg-surface-dim">
                <img src="${contributorAvatar}" class="w-full h-full object-cover" alt="Contributor Avatar">
              </div>
              <div class="text-left">
                <div class="font-headline-md text-sm font-bold text-on-surface">${contributorName}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-stat-display text-xl text-primary font-bold">${impactBadge}</div>
              <div class="font-label-caps text-[9px] text-outline flex items-center justify-end gap-1">
                <span class="material-symbols-outlined text-[12px]">location_on</span>
                ${sub.location || 'Bidar'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hover Video listeners
    const videoEl = card.querySelector('video');
    if (videoEl) {
      card.addEventListener('mouseenter', () => {
        videoEl.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        videoEl.pause();
      });
    }

    feedGrid.appendChild(card);
  });
}

// Category Icons
function getCategoryIconName(cat) {
  if (cat === "Waste & Plastic Eradication") return "recycling";
  if (cat === "Afforestation / Tree Plantation") return "nature";
  if (cat === "Water Body Restoration") return "water_drop";
  if (cat === "Civic Awareness Drive") return "campaign";
  return "eco";
}

// Category Fallback Cover Image
function getCategoryFallbackImage(category, index) {
  if (category === "Afforestation / Tree Plantation") {
    return FALLBACK_IMAGES[0];
  } else if (category === "Waste & Plastic Eradication") {
    return FALLBACK_IMAGES[1];
  } else if (category === "Water Body Restoration") {
    return FALLBACK_IMAGES[1];
  } else if (category === "Civic Awareness Drive") {
    return FALLBACK_IMAGES[2];
  }
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

// Impact badges text
function getImpactValueText(sub) {
  if (sub.category === "Afforestation / Tree Plantation") {
    return "+50 Trees";
  } else if (sub.category === "Waste & Plastic Eradication") {
    return "150kg Cleaned";
  } else if (sub.category === "Water Body Restoration") {
    return "Verified Water";
  }
  return "+1 Action";
}

// 7. Stats Counter Animation
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

// 8. Filter Selection Click Handler
filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  // Set active style classes
  const allBtns = filterBar.querySelectorAll('.filter-btn');
  allBtns.forEach(b => {
    b.className = "filter-btn flex items-center gap-2 px-6 py-2 rounded-full border border-primary/20 bg-surface hover:bg-surface-variant text-on-surface font-headline-md text-[14px] whitespace-nowrap transition-all";
  });

  // Highlight selected
  btn.className = "filter-btn flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-on-primary font-headline-md text-[14px] whitespace-nowrap transition-transform hover:scale-105";

  const targetCategory = btn.getAttribute('data-category');
  renderFeedGrid(targetCategory);
});

// Initialization sequence
async function initFeed() {
  await loadFeedData();
}

initFeed();
