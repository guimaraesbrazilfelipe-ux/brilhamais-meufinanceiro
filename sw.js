/**
 * ==============================================================================
 * BRILHACASH - SERVICE WORKER (PWA)
 * ==============================================================================
 * Estratégia de cache híbrida e segura:
 * - Network-Only para APIs e autenticação do Supabase (sem cache de credenciais)
 * - Network-First para navegação HTML com fallback para offline.html
 * - Stale-While-Revalidate para assets estáticos (CSS, JS, Ícones e CDNs)
 * ==============================================================================
 */

const CACHE_NAME = "brilhacash-v16";

const PRECACHE_ASSETS = [
    "./",
    "index.html",
    "lancamentos.html",
    "contas-fixas.html",
    "agenda.html",
    "relatorios.html",
    "historico.html",
    "planejamento.html",
    "conquistas.html",
    "configuracoes.html",
    "offline.html",
    "style1.css",
    "script.js",
    "authModal.js",
    "activityLogger.js",
    "supabaseClient.js",
    "manifest.json",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-192.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png",
    "icons/favicon.png",
    "https://cdn.jsdelivr.net/npm/chart.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

// 1. Instalação: Cacheia os arquivos do núcleo do aplicativo (Shell)
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// 2. Ativação: Limpa versões obsoletas de caches anteriores
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// 3. Comunicação para atualização de Service Worker
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// 4. Interceptação de Requisições (Fetch)
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Regra 1: Requisições que não sejam GET nunca são cacheadas
    if (request.method !== "GET") {
        return;
    }

    // Regra 2: Supabase e Autenticação (Network-Only estrito)
    // Impede absolutamente qualquer cache de dados de usuário, tokens ou sessões
    if (url.hostname.includes("supabase.co") || url.pathname.includes("/auth/") || url.pathname.includes("/rest/")) {
        event.respondWith(fetch(request));
        return;
    }

    // Regra 3: Navegação de Páginas HTML (Network-First com fallback para Offline)
    if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Se falhar a rede, busca no cache a página solicitada
                    const cachedPage = await caches.match(request);
                    if (cachedPage) {
                        return cachedPage;
                    }
                    // Se não tiver em cache, exibe a página offline
                    const offlinePage = await caches.match("offline.html");
                    if (offlinePage) {
                        return offlinePage;
                    }
                    return new Response("Você está offline.", {
                        status: 503,
                        headers: { "Content-Type": "text/plain; charset=utf-8" }
                    });
                })
        );
        return;
    }

    // Regra 4: Assets Estáticos (CSS, JS, Imagens, Fontes e CDNs) -> Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return networkResponse;
            }).catch(() => {
                // Se offline e não há cache, o erro é propagado silenciosamente
            });

            // Retorna imediatamente do cache se existir, ou aguarda o fetch de rede
            return cachedResponse || fetchPromise;
        })
    );
});

// 4. Notificações do PWA: Clique na notificação abre ou foca no destino adequado
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "./index.html";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Se já tiver uma janela aberta, foca nela e redireciona para a página de destino
            for (const client of clientList) {
                if ("focus" in client) {
                    if ("navigate" in client && targetUrl) {
                        try {
                            client.navigate(targetUrl);
                        } catch (e) {}
                    }
                    return client.focus();
                }
            }
            // Se não houver janela aberta, abre a página apropriada
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
