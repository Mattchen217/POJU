<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>The Archive - POJU</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "surface-container": "#211e27",
                      "surface": "#15121b",
                      "on-primary": "#3c0091",
                      "on-secondary-fixed": "#1c1b1c",
                      "surface-container-highest": "#37333d",
                      "primary-fixed": "#e9ddff",
                      "tertiary-fixed": "#e4e1e7",
                      "primary-container": "#a078ff",
                      "on-secondary": "#313031",
                      "primary": "#d0bcff",
                      "inverse-on-surface": "#322f39",
                      "on-surface": "#e7e0ed",
                      "inverse-surface": "#e7e0ed",
                      "background": "#15121b",
                      "tertiary-container": "#919095",
                      "tertiary": "#c8c5cb",
                      "surface-variant": "#37333d",
                      "on-primary-container": "#340080",
                      "on-tertiary-fixed-variant": "#47464b",
                      "on-error-container": "#ffdad6",
                      "on-background": "#e7e0ed",
                      "surface-bright": "#3b3742",
                      "secondary-fixed": "#e5e2e3",
                      "secondary": "#c8c6c7",
                      "secondary-container": "#4a494a",
                      "inverse-primary": "#6d3bd7",
                      "surface-container-lowest": "#0f0d15",
                      "outline-variant": "#494454",
                      "on-primary-fixed": "#23005c",
                      "error-container": "#93000a",
                      "surface-container-low": "#1d1a23",
                      "outline": "#958ea0",
                      "on-surface-variant": "#cbc3d7",
                      "secondary-fixed-dim": "#c8c6c7",
                      "tertiary-fixed-dim": "#c8c5cb",
                      "on-secondary-container": "#bab8b9",
                      "error": "#ffb4ab",
                      "on-tertiary-fixed": "#1b1b1f",
                      "on-tertiary": "#303034",
                      "surface-dim": "#15121b",
                      "on-secondary-fixed-variant": "#474647",
                      "on-error": "#690005",
                      "on-primary-fixed-variant": "#5516be",
                      "surface-container-high": "#2c2832",
                      "primary-fixed-dim": "#d0bcff",
                      "on-tertiary-container": "#29292d",
                      "surface-tint": "#d0bcff"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "spacing": {
                      "xs": "0.5rem",
                      "md": "1.5rem",
                      "xl": "3rem",
                      "gutter": "1rem",
                      "sm": "1rem",
                      "lg": "2rem",
                      "unit": "4px",
                      "container-margin": "1.5rem"
              },
              "fontFamily": {
                      "headline-md": [
                              "manrope"
                      ],
                      "body-lg": [
                              "inter"
                      ],
                      "display-xl": [
                              "manrope"
                      ],
                      "body-md": [
                              "inter"
                      ],
                      "label-sm": [
                              "inter"
                      ],
                      "headline-lg": [
                              "manrope"
                      ]
              },
              "fontSize": {
                      "headline-md": [
                              "24px",
                              {
                                      "lineHeight": "1.4",
                                      "fontWeight": "600"
                              }
                      ],
                      "body-lg": [
                              "18px",
                              {
                                      "lineHeight": "1.6",
                                      "fontWeight": "400"
                              }
                      ],
                      "display-xl": [
                              "40px",
                              {
                                      "lineHeight": "1.2",
                                      "letterSpacing": "-0.02em",
                                      "fontWeight": "700"
                              }
                      ],
                      "body-md": [
                              "16px",
                              {
                                      "lineHeight": "1.6",
                                      "fontWeight": "400"
                              }
                      ],
                      "label-sm": [
                              "12px",
                              {
                                      "lineHeight": "1",
                                      "letterSpacing": "0.05em",
                                      "fontWeight": "500"
                              }
                      ],
                      "headline-lg": [
                              "32px",
                              {
                                      "lineHeight": "1.3",
                                      "fontWeight": "600"
                              }
                      ]
              }
      },
          },
        }
    </script>
<style>
        .glass-card {
            background: rgba(30, 30, 34, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-top: 1px solid rgba(255, 255, 255, 0.15);
        }
        .aura-bg {
            background: radial-gradient(circle at 50% -20%, rgba(139, 92, 246, 0.15), transparent 60%);
        }
    </style>
</head>
<body class="bg-background text-on-background min-h-screen relative font-body-md text-body-md overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
<!-- Ambient Aura Background -->
<div class="fixed inset-0 pointer-events-none aura-bg z-0"></div>
<!-- TopAppBar (Web) -->
<header class="hidden md:flex justify-between items-center px-6 py-4 w-full sticky top-0 z-50 bg-[#1E1E22]/60 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
<div class="text-2xl font-bold tracking-widest text-violet-500 uppercase font-['Manrope'] tracking-tight">POJU</div>
<!-- Web Nav (mapped from JSON tab_labels logic) -->
<nav class="flex gap-8">
<a class="text-white/40 hover:text-violet-300 transition-colors" href="#">Vault</a>
<a class="text-white/40 hover:text-violet-300 transition-colors" href="#">Oracle</a>
<a class="text-white/40 hover:text-violet-300 transition-colors" href="#">Sync</a>
<a class="text-violet-400 font-bold hover:text-violet-300 transition-colors" href="#">Archive</a>
</nav>
<div class="flex gap-4">
<button class="text-violet-500 hover:text-violet-300 transition-colors"><span class="material-symbols-outlined" data-icon="settings">settings</span></button>
<button class="text-violet-500 hover:text-violet-300 transition-colors"><span class="material-symbols-outlined" data-icon="account_circle">account_circle</span></button>
</div>
</header>
<!-- Main Content Canvas -->
<main class="relative z-10 w-full max-w-4xl mx-auto px-6 py-8 md:py-12 pb-32 md:pb-12">
<!-- Header Section -->
<div class="mb-10 text-center md:text-left">
<h1 class="font-display-xl text-display-xl text-primary mb-2 tracking-tight">✦ THE ARCHIVE.</h1>
<p class="font-body-lg text-body-lg text-on-surface-variant/70">Everything here lives only on this device.</p>
</div>
<!-- Controls: Search & Filter -->
<div class="mb-12 space-y-6">
<!-- Search Bar -->
<div class="relative max-w-xl mx-auto md:mx-0">
<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
<input class="w-full bg-surface-container-high/50 border border-outline-variant/30 text-on-surface font-body-md text-body-md rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all backdrop-blur-md placeholder:text-on-surface-variant/40" placeholder="Search your history..." type="text"/>
</div>
<!-- Filter Chips -->
<div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
<button class="bg-primary/10 border border-primary/20 text-primary font-label-sm text-label-sm px-4 py-2 rounded-full whitespace-nowrap">All</button>
<button class="bg-surface-container-high/50 border border-outline-variant/20 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm px-4 py-2 rounded-full whitespace-nowrap transition-colors">POJU</button>
<button class="bg-surface-container-high/50 border border-outline-variant/20 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm px-4 py-2 rounded-full whitespace-nowrap transition-colors">Syncro</button>
<button class="bg-surface-container-high/50 border border-outline-variant/20 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm px-4 py-2 rounded-full whitespace-nowrap transition-colors">Oracle</button>
</div>
</div>
<!-- History Groups -->
<div class="space-y-12">
<!-- Today Group -->
<section>
<h2 class="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-4 pl-2 border-l-2 border-primary/30">Today</h2>
<div class="space-y-4">
<!-- POJU Entry -->
<div class="glass-card rounded-2xl p-5 hover:bg-surface-container-highest/60 transition-all duration-300 group">
<div class="flex items-start justify-between gap-4">
<div class="flex items-center gap-3 mb-3">
<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
<span class="material-symbols-outlined text-sm" data-icon="forum">forum</span>
</div>
<span class="font-label-sm text-label-sm text-primary uppercase tracking-widest">POJU Session</span>
</div>
</div>
<div class="mb-5">
<h3 class="font-headline-md text-headline-md text-on-surface mb-1">"Dad and I keep..."</h3>
<p class="font-body-md text-body-md text-on-surface-variant/60 flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                Still active · 12 messages
                            </p>
</div>
<div class="flex flex-wrap gap-3">
<button class="bg-primary/20 hover:bg-primary/30 text-primary font-label-sm text-label-sm px-5 py-2 rounded-lg border border-primary/30 transition-colors">Resume</button>
<button class="bg-transparent hover:bg-surface-container-highest border border-outline-variant text-on-surface-variant font-label-sm text-label-sm px-5 py-2 rounded-lg transition-colors">Archive</button>
<button class="bg-transparent hover:bg-error-container/20 hover:text-error border border-outline-variant hover:border-error/30 text-on-surface-variant font-label-sm text-label-sm px-5 py-2 rounded-lg transition-colors ml-auto">Wipe</button>
</div>
</div>
<!-- Oracle Entry -->
<div class="glass-card rounded-2xl p-5 hover:bg-surface-container-highest/60 transition-all duration-300">
<div class="flex items-start justify-between gap-4">
<div class="flex items-center gap-3 mb-3">
<div class="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
<span class="material-symbols-outlined text-sm" data-icon="auto_awesome">auto_awesome</span>
</div>
<span class="font-label-sm text-label-sm text-amber-400 uppercase tracking-widest">Oracle</span>
</div>
</div>
<div class="mb-5">
<h3 class="font-headline-md text-headline-md text-on-surface mb-2">"About my decision to move..."</h3>
<div class="inline-flex items-center gap-2 bg-surface-container/50 border border-outline-variant/30 rounded-lg px-3 py-1.5">
<span class="material-symbols-outlined text-xs text-amber-400">water_drop</span>
<span class="font-body-md text-body-md text-on-surface-variant text-sm">✦ Calm Current · Sign of Flow</span>
</div>
</div>
<div class="flex gap-3">
<button class="bg-transparent hover:bg-surface-container-highest border border-outline-variant text-on-surface font-label-sm text-label-sm px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
<span class="material-symbols-outlined text-sm" data-icon="visibility">visibility</span> View
                            </button>
</div>
</div>
</div>
</section>
<!-- Yesterday Group -->
<section>
<h2 class="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-4 pl-2 border-l-2 border-outline-variant/50">Yesterday</h2>
<div class="space-y-4">
<!-- Syncro Entry -->
<div class="glass-card rounded-2xl p-5 hover:bg-surface-container-highest/60 transition-all duration-300">
<div class="flex items-start justify-between gap-4">
<div class="flex items-center gap-3 mb-3">
<div class="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
<span class="material-symbols-outlined text-sm" data-icon="sync">sync</span>
</div>
<span class="font-label-sm text-label-sm text-cyan-400 uppercase tracking-widest">Syncro</span>
</div>
</div>
<div class="mb-5">
<h3 class="font-headline-md text-headline-md text-on-surface mb-2">"My desk · Facing Northwest"</h3>
<div class="inline-flex items-center gap-2 bg-surface-container/50 border border-outline-variant/30 rounded-lg px-3 py-1.5">
<span class="material-symbols-outlined text-xs text-cyan-400">schedule</span>
<span class="font-body-md text-body-md text-on-surface-variant text-sm">Shen hour · 3:47 PM</span>
</div>
</div>
<div class="flex gap-3">
<button class="bg-transparent hover:bg-surface-container-highest border border-outline-variant text-on-surface font-label-sm text-label-sm px-5 py-2 rounded-lg transition-colors">View</button>
<button class="bg-transparent hover:bg-surface-container-highest border border-outline-variant text-on-surface font-label-sm text-label-sm px-5 py-2 rounded-lg transition-colors">Re-read now</button>
</div>
</div>
</div>
</section>
</div>
<!-- Dangerous Action -->
<div class="mt-20 text-center md:text-left">
<button class="text-on-surface-variant/50 hover:text-error transition-colors font-label-sm text-label-sm flex items-center justify-center md:justify-start gap-2 mx-auto md:mx-0 py-2">
<span class="material-symbols-outlined text-sm" data-icon="delete_forever">delete_forever</span>
                Wipe everything
            </button>
</div>
</main>
<!-- BottomNavBar (Mobile) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#1E1E22]/60 backdrop-blur-2xl z-50 border-t border-white/10 rounded-t-2xl shadow-[0_-10px_40px_rgba(139,92,246,0.15)]">
<a class="flex flex-col items-center justify-center text-white/30 px-3 py-1 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined mb-1" data-icon="inventory_2">inventory_2</span>
<span class="font-['Manrope'] text-[10px] font-medium uppercase tracking-tighter">Vault</span>
</a>
<a class="flex flex-col items-center justify-center text-white/30 px-3 py-1 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined mb-1" data-icon="auto_awesome">auto_awesome</span>
<span class="font-['Manrope'] text-[10px] font-medium uppercase tracking-tighter">Oracle</span>
</a>
<a class="flex flex-col items-center justify-center text-white/30 px-3 py-1 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined mb-1" data-icon="sync">sync</span>
<span class="font-['Manrope'] text-[10px] font-medium uppercase tracking-tighter">Sync</span>
</a>
<a class="flex flex-col items-center justify-center text-violet-400 bg-violet-500/10 rounded-xl px-3 py-1 scale-105 duration-200" href="#">
<span class="material-symbols-outlined mb-1" data-icon="archive" style="font-variation-settings: 'FILL' 1;">archive</span>
<span class="font-['Manrope'] text-[10px] font-medium uppercase tracking-tighter">Archive</span>
</a>
</nav>
</body></html>