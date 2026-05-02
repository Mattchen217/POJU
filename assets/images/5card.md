<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Mythic Vault</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&amp;family=Rajdhani:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#00f0ff",
                        "background-light": "#f3f4f6",
                        "background-dark": "#0a0a0a",
                        "surface-dark": "#121212",
                        "surface-light": "#ffffff",
                    },
                    fontFamily: {
                        display: ["Orbitron", "sans-serif"],
                        body: ["Rajdhani", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "0.5rem",
                    },
                },
            },
        };
    </script>
<style>
        body {
            font-family: 'Rajdhani', sans-serif;
        }
        h1, h2, h3, h4, h5, h6, .font-display {
            font-family: 'Orbitron', sans-serif;
        }
        .glow-gold:hover {
            box-shadow: 0 0 20px 5px rgba(255, 215, 0, 0.4);
        }
        .glow-cyan:hover {
            box-shadow: 0 0 20px 5px rgba(0, 240, 255, 0.4);
        }
        .glow-teal:hover {
            box-shadow: 0 0 20px 5px rgba(0, 255, 204, 0.4);
        }
        .glow-purple:hover {
            box-shadow: 0 0 20px 5px rgba(153, 50, 204, 0.4);
        }
        .glow-red:hover {
            box-shadow: 0 0 20px 5px rgba(255, 0, 0, 0.4);
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 min-h-screen flex flex-col transition-colors duration-300">
<nav class="bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div class="flex justify-between h-16">
<div class="flex items-center">
<a class="flex-shrink-0 flex items-center gap-2" href="#">
<span class="material-icons text-primary text-3xl">auto_awesome</span>
<span class="font-display font-bold text-xl tracking-wider text-gray-900 dark:text-white uppercase">Mythic Vault</span>
</a>
</div>
<div class="hidden md:flex items-center space-x-8">
<a class="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-display uppercase tracking-widest" href="#">Gallery</a>
<a class="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-display uppercase tracking-widest" href="#">Collections</a>
<a class="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-display uppercase tracking-widest" href="#">Marketplace</a>
<button class="bg-primary/10 dark:bg-primary/20 text-primary border border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30 px-4 py-2 rounded-md text-sm font-bold transition-all font-display uppercase tracking-widest">Connect Wallet</button>
</div>
</div>
</div>
</nav>
<main class="flex-grow">
<div class="relative py-16 sm:py-24 overflow-hidden">
<div class="absolute inset-0 flex justify-center items-center opacity-10 pointer-events-none">
<div class="w-96 h-96 bg-primary rounded-full blur-[100px]"></div>
</div>
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
<h1 class="text-4xl sm:text-5xl md:text-6xl font-display font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                    Discover <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">Legendary</span> Artifacts
                </h1>
<p class="mt-4 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Explore the most coveted digital cards in the Neon Syndicate universe. High-fidelity assets ready for deployment.
                </p>
</div>
</div>
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
<div class="flex flex-col items-center group">
<div class="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 transition-all duration-300 transform group-hover:-translate-y-2 glow-gold">
<img alt="Divine Tailwind - A golden phoenix rising" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0ujkd5MeFygdhD2MqsJK9gLyobWJIlywiUdTuFaimszCSt6H2URlgnOqD6v8pB-v93yNlyz77w5GfWYQEHwJ3kN9CzOUAmsY7lQYTyppt-dnP6bemiKufEzsfBypOm0a5364ocvPvinCc3dCxJbzE7SCtfvj4tf8ffK-yF7-93qbk2lok5NZezmRzFBiRnNPuB8WaLVdfcN5vW6OW5MtN1UyxQJjiUkU3RBwmVy2g_3X8r5Nt2CqXCr6-bE"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
<h3 class="font-display font-bold text-white text-lg uppercase tracking-wider text-center drop-shadow-md">Divine Tailwind</h3>
</div>
</div>
<button class="mt-6 w-full flex items-center justify-center gap-2 bg-surface-light dark:bg-surface-dark border border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary text-gray-800 dark:text-gray-200 hover:text-primary dark:hover:text-primary px-4 py-3 rounded-md transition-all font-bold uppercase tracking-widest text-sm">
<span class="material-icons text-sm">download</span>
                        Download Assets
                    </button>
</div>
<div class="flex flex-col items-center group">
<div class="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 transition-all duration-300 transform group-hover:-translate-y-2 glow-cyan">
<img alt="Fair Sky - Bright blue sky with fluffy clouds" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0ujJada1xAbpcj2njP3Yvap1xq-UqFXrkbJqiocyVu5FZG78UGyqC4aeO9ZR-f4KyLR5h-IEKv5L_F0zm7-PQHYgOZ7E2nYvJtB_j74na3K8GcXgeUjY2E0DAA_fAu5ep8jrq12vxAE2d6TswDfHKVK4WZugyswM0duTQwVXoQvNFPmE8HZ2qfTPNAwutJlFYCjWiiwWGgLiD6AO7wBabfhGe_SAtLvr68HiJVlIxB79PFSE3la-02RR6g"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
<h3 class="font-display font-bold text-white text-lg uppercase tracking-wider text-center drop-shadow-md">Fair Sky</h3>
</div>
</div>
<button class="mt-6 w-full flex items-center justify-center gap-2 bg-surface-light dark:bg-surface-dark border border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary text-gray-800 dark:text-gray-200 hover:text-primary dark:hover:text-primary px-4 py-3 rounded-md transition-all font-bold uppercase tracking-widest text-sm">
<span class="material-icons text-sm">download</span>
                        Download Assets
                    </button>
</div>
<div class="flex flex-col items-center group">
<div class="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 transition-all duration-300 transform group-hover:-translate-y-2 glow-teal">
<img alt="Still Water - Full moon over calm waters" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCn_nv5fFAORx9wsa0XXPl7LO1xUH5UDf-5btjlUdezIOD2FUjAQ1RezHl5GSZ3IlKfzXiMk1XWG-77BwpORqj3nOxsWMgXWeij7YAHqlOKvcGxm95636C1WauAWI-P2hk-L97GyREYYtQlKvKfduPnQdc8iVGC7svTDImv4s5yhsHGepO9MN8_0Fn41OSPUVXg-9pcUIfgyhENjvkW_aMtXGf94Lrf_Vc9nkm0d3fCCF_06qEECzDShj7oJSUjJMXx6kiNXmcR1yg"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
<h3 class="font-display font-bold text-white text-lg uppercase tracking-wider text-center drop-shadow-md">Still Water</h3>
</div>
</div>
<button class="mt-6 w-full flex items-center justify-center gap-2 bg-surface-light dark:bg-surface-dark border border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary text-gray-800 dark:text-gray-200 hover:text-primary dark:hover:text-primary px-4 py-3 rounded-md transition-all font-bold uppercase tracking-widest text-sm">
<span class="material-icons text-sm">download</span>
                        Download Assets
                    </button>
</div>
<div class="flex flex-col items-center group">
<div class="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 transition-all duration-300 transform group-hover:-translate-y-2 glow-purple">
<img alt="Crosswind - Purple galactic swirl" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0ugx_6CSMY1WYnQ1Sa_ALsY9bBBkiJ-6dkxyAbLFfDWKdWeZxG0d3QKTxS7cDYDyrSJmQNuUwSmsrDI7kmioAaMZGaDjpDI6pBW44JxCYI9WhLVOUZ7v0TeUHX50BNfZlTDaU39dWao-ajBryccINnZSAdLXTQM-ugdlhlHj9hY0f_vZivNIMh8kceMom9kIoYgxBOjTaHmXNWnfxYVtsyEFl-iiPBXpyecZvDPaOM3w4kHnkkq_Mptk9g"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
<h3 class="font-display font-bold text-white text-lg uppercase tracking-wider text-center drop-shadow-md">Crosswind</h3>
</div>
</div>
<button class="mt-6 w-full flex items-center justify-center gap-2 bg-surface-light dark:bg-surface-dark border border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary text-gray-800 dark:text-gray-200 hover:text-primary dark:hover:text-primary px-4 py-3 rounded-md transition-all font-bold uppercase tracking-widest text-sm">
<span class="material-icons text-sm">download</span>
                        Download Assets
                    </button>
</div>
<div class="flex flex-col items-center group">
<div class="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 transition-all duration-300 transform group-hover:-translate-y-2 glow-red">
<img alt="Eye of Storm - Red lightning storm eye" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0ug-MtW9p5ApDt9jweio6h3Hb5VCOYjU6QrATWPNhPrPa58PDzLtHA-yRIqTam6nKnHojMQ71Utq1MvYR2AMC9MQ9qgqYlO9_dxAcEeIcIr_URBYeRSakurgGraMy-mxH9qqNRdekVMX3jMztt4mOT4NgL7_AwDjk6bFhEhpl8b-r8Ci754vIteEgz-aTexzC62Dcwxc1g9NT_iZgBNkt9rXgnpBd-vF8zH1iLicIcfLOmmeHsYafeIoBg"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
<h3 class="font-display font-bold text-white text-lg uppercase tracking-wider text-center drop-shadow-md">Eye of Storm</h3>
</div>
</div>
<button class="mt-6 w-full flex items-center justify-center gap-2 bg-surface-light dark:bg-surface-dark border border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary text-gray-800 dark:text-gray-200 hover:text-primary dark:hover:text-primary px-4 py-3 rounded-md transition-all font-bold uppercase tracking-widest text-sm">
<span class="material-icons text-sm">download</span>
                        Download Assets
                    </button>
</div>
</div>
</div>
</main>
<footer class="bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 mt-auto">
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
<div class="flex flex-col md:flex-row justify-between items-center gap-6">
<div class="flex items-center gap-2">
<span class="material-icons text-primary text-2xl">auto_awesome</span>
<span class="font-display font-bold text-lg text-gray-900 dark:text-white uppercase tracking-wider">Mythic Vault</span>
</div>
<div class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    © 2024 Neon Syndicate. All rights reserved.
                </div>
<div class="flex gap-4">
<a class="text-gray-400 hover:text-primary dark:hover:text-primary transition-colors" href="#">
<span class="material-icons">share</span>
</a>
<a class="text-gray-400 hover:text-primary dark:hover:text-primary transition-colors" href="#">
<span class="material-icons">forum</span>
</a>
<a class="text-gray-400 hover:text-primary dark:hover:text-primary transition-colors" href="#">
<span class="material-icons">help_outline</span>
</a>
</div>
</div>
</div>
</footer>
</body></html>