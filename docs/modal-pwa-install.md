<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>POJU - Add to Home Screen</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Manrope:wght@600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-weight: normal;
            font-style: normal;
            font-size: 24px;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-smoothing: antialiased;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "error": "#ffb4ab",
                        "on-tertiary-fixed": "#1b1b1f",
                        "on-tertiary": "#303034",
                        "surface-dim": "#15121b",
                        "on-secondary-fixed-variant": "#474647",
                        "on-error": "#690005",
                        "on-secondary-container": "#bab8b9",
                        "on-primary-fixed-variant": "#5516be",
                        "surface-container-high": "#2c2832",
                        "primary-fixed-dim": "#d0bcff",
                        "on-tertiary-container": "#29292d",
                        "surface-tint": "#d0bcff",
                        "on-tertiary-fixed-variant": "#47464b",
                        "on-error-container": "#ffdad6",
                        "on-background": "#e7e0ed",
                        "surface-bright": "#3b3742",
                        "secondary-fixed": "#e5e2e3",
                        "secondary": "#c8c6c7",
                        "secondary-container": "#4a494a",
                        "inverse-primary": "#6d3bd7",
                        "on-primary-container": "#340080",
                        "tertiary-fixed-dim": "#c8c5cb",
                        "surface-container-lowest": "#0f0d15",
                        "outline-variant": "#494454",
                        "on-primary-fixed": "#23005c",
                        "error-container": "#93000a",
                        "surface-container-low": "#1d1a23",
                        "outline": "#958ea0",
                        "on-surface-variant": "#cbc3d7",
                        "secondary-fixed-dim": "#c8c6c7",
                        "on-surface": "#e7e0ed",
                        "primary": "#d0bcff",
                        "inverse-on-surface": "#322f39",
                        "tertiary-container": "#919095",
                        "tertiary": "#c8c5cb",
                        "surface-variant": "#37333d",
                        "inverse-surface": "#e7e0ed",
                        "background": "#15121b",
                        "surface-container": "#211e27",
                        "surface": "#15121b",
                        "on-primary": "#3c0091",
                        "on-secondary-fixed": "#1c1b1c",
                        "primary-fixed": "#e9ddff",
                        "tertiary-fixed": "#e4e1e7",
                        "primary-container": "#a078ff",
                        "on-secondary": "#313031",
                        "surface-container-highest": "#37333d"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "sm": "1rem",
                        "xl": "3rem",
                        "gutter": "1rem",
                        "xs": "0.5rem",
                        "md": "1.5rem",
                        "unit": "4px",
                        "container-margin": "1.5rem",
                        "lg": "2rem"
                    },
                    "fontFamily": {
                        "body-md": ["inter"],
                        "display-xl": ["manrope"],
                        "headline-md": ["manrope"],
                        "body-lg": ["inter"],
                        "headline-lg": ["manrope"],
                        "label-sm": ["inter"]
                    },
                    "fontSize": {
                        "body-md": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
                        "display-xl": ["40px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
                        "headline-md": ["24px", { "lineHeight": "1.4", "fontWeight": "600" }],
                        "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }],
                        "headline-lg": ["32px", { "lineHeight": "1.3", "fontWeight": "600" }],
                        "label-sm": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "500" }]
                    }
                }
            }
        }
    </script>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-surface-container-lowest font-body-md text-on-surface antialiased overflow-hidden min-h-screen relative flex items-center justify-center">
<!-- Blurred Background Context (Simulated Chat/Syncro view) -->
<div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
<div class="w-full h-full bg-surface-container/50 p-6 flex flex-col gap-4 opacity-40 blur-[8px] scale-[1.02]">
<!-- Fake Top Bar -->
<div class="flex items-center justify-between border-b border-outline-variant/30 pb-4">
<div class="w-8 h-8 rounded-full bg-surface-container-highest"></div>
<div class="w-24 h-6 bg-surface-container-highest rounded-full"></div>
<div class="w-8 h-8 rounded-full bg-surface-container-highest"></div>
</div>
<!-- Fake Content Area -->
<div class="flex-1 flex flex-col gap-6 mt-4">
<div class="self-start w-3/4 h-24 bg-surface-container-high rounded-2xl rounded-tl-sm"></div>
<div class="self-end w-2/3 h-16 bg-primary-container/20 border border-primary-fixed/10 rounded-2xl rounded-tr-sm"></div>
<div class="self-start w-1/2 h-20 bg-surface-container-high rounded-2xl rounded-tl-sm"></div>
</div>
</div>
<!-- Cosmic Gradient Overlay -->
<div class="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary-container/10 via-transparent to-surface-container-lowest/90"></div>
</div>
<!-- Modal Backdrop -->
<div class="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-md z-40"></div>
<!-- Bottom Sheet Container (Simulating Mobile Viewport Constraint on Desktop, fixed bottom on mobile) -->
<div class="fixed inset-x-0 bottom-0 md:relative md:bottom-auto w-full max-w-md mx-auto z-50 flex flex-col pb-safe">
<!-- The Glassmorphic Sheet -->
<div class="bg-[#1e1e22]/60 backdrop-blur-[24px] rounded-t-[32px] md:rounded-[32px] border border-primary-fixed/20 border-b-0 md:border-b p-6 pt-4 flex flex-col gap-8 shadow-[0_-10px_40px_rgba(160,120,255,0.15)] relative overflow-hidden">
<!-- Subtle inner glow top edge -->
<div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary-fixed/40 to-transparent"></div>
<!-- Drag Handle (Visual only) -->
<div class="w-12 h-1.5 bg-outline-variant rounded-full mx-auto shrink-0"></div>
<div class="flex flex-col gap-6">
<!-- Header -->
<div class="flex flex-col items-center text-center gap-4">
<!-- POJU Logo Mark -->
<div class="w-14 h-14 rounded-full bg-gradient-to-br from-inverse-primary to-primary-container flex items-center justify-center shadow-[0_0_24px_rgba(160,120,255,0.3)] border border-primary-fixed/30">
<span class="font-display-xl text-headline-md text-on-primary font-black tracking-widest uppercase">P</span>
</div>
<div class="flex flex-col gap-1">
<h2 class="font-headline-md text-headline-md text-on-surface">Add POJU to your home screen</h2>
<p class="font-body-md text-body-md text-on-surface-variant max-w-[280px] mx-auto">Experience the Oracle as a native app.</p>
</div>
</div>
<!-- Benefits List -->
<div class="bg-surface-container-low/50 rounded-2xl p-4 border border-outline-variant/30 flex flex-col gap-4">
<div class="flex items-center gap-4">
<div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/20 shrink-0">
<span class="material-symbols-outlined text-primary text-[18px]">fullscreen</span>
</div>
<span class="font-body-md text-body-md text-on-surface-variant">Full-screen experience.</span>
</div>
<div class="flex items-center gap-4">
<div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/20 shrink-0">
<span class="material-symbols-outlined text-primary text-[18px]">web_asset_off</span>
</div>
<span class="font-body-md text-body-md text-on-surface-variant">No browser bars.</span>
</div>
<div class="flex items-center gap-4">
<div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/20 shrink-0">
<span class="material-symbols-outlined text-primary text-[18px]">wifi_off</span>
</div>
<span class="font-body-md text-body-md text-on-surface-variant">Works offline.</span>
</div>
</div>
<!-- 2-Step Guide -->
<div class="flex flex-col gap-5 px-1">
<!-- Step 1 -->
<div class="flex items-start gap-4">
<div class="w-7 h-7 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-fixed/30 mt-0.5">
<span class="font-label-sm text-label-sm text-primary-fixed font-bold">1</span>
</div>
<div class="flex-1">
<p class="font-body-md text-[15px] leading-relaxed text-on-surface">
                                Tap the <strong class="text-primary-fixed font-semibold">Share</strong> icon 
                                <span class="inline-flex items-center justify-center w-7 h-7 mx-1 rounded-md bg-surface-container border border-outline-variant/50 align-middle shadow-sm">
<span class="material-symbols-outlined text-[18px] text-primary-fixed">ios_share</span>
</span>
                                in your browser's toolbar.
                            </p>
</div>
</div>
<!-- Step 2 -->
<div class="flex items-start gap-4">
<div class="w-7 h-7 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-fixed/30 mt-0.5">
<span class="font-label-sm text-label-sm text-primary-fixed font-bold">2</span>
</div>
<div class="flex-1">
<p class="font-body-md text-[15px] leading-relaxed text-on-surface">
                                Scroll down and tap 
                                <span class="inline-flex items-center px-2.5 py-1 mx-1 rounded-md bg-surface-container border border-outline-variant/50 align-middle shadow-sm gap-1.5">
<span class="text-[13px] font-semibold text-primary-fixed">Add to Home Screen</span>
<span class="material-symbols-outlined text-[16px] text-primary-fixed">add_box</span>
</span>
</p>
</div>
</div>
</div>
<!-- Actions -->
<div class="flex flex-col gap-2 mt-2">
<button class="w-full py-4 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold tracking-[0.08em] uppercase shadow-[0_0_20px_rgba(160,120,255,0.25)] border border-primary-fixed/30 hover:bg-inverse-primary hover:text-white">
                        Got it
                    </button>
<button class="w-full py-4 rounded-full text-on-surface-variant font-label-sm text-label-sm font-medium tracking-[0.05em] hover:text-on-surface hover:bg-surface-container-low/50">
                        Later
                    </button>
</div>
</div>
</div>
</div>
</body></html>