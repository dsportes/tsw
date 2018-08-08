const shortcuts = {"?": "prod-index", "index2": "prod-index2", "index": "prod-index", "d": "demo-index", "admin": "prod-index2"};
const inb = 4; 
const uib = [11] ;
const cp = "tsw"; const CP = cp ? "/" + cp + "/" : "/"; const CPOP = CP + "$op/"; const CPUI = CP + "$ui/"; const BC = inb + "." + uib[0]; const x = CPUI + BC +"/";
const lres = [
	x + "helper.js",
	x + "home.html",
	x + "favicon.ico"
];

// suite du script

const CACHENAME =  (cp ? cp : "root") + "_" + BC;	
const TRACEON = true;	// trace sur erreurs
const TRACEON2 = true; // trace sur actions normales
const VCACHES = { }
const BUILDS = { }
const TIME_OUT_MS = 30000;
const encoder = new TextEncoder("utf-8");

for(let i = 0, b = 0; b = uib[i]; i++) {
	VCACHES[(cp ? cp : "root") + "_" + inb + "." + b] = true;
	BUILDS[inb + "." + b] = true;
}

// installation des ressources requises pour la build BC
this.addEventListener('install', function(event) {
	if (TRACEON) console.log("Install de " + BC);
	event.waitUntil(
		caches.open(CACHENAME)
		.then(cache => {
			if (TRACEON2) console.log("Install addAll demandé ... " + BC + "\n" + lres.join("\n"));
			const res = cache.addAll(lres);
			if (TRACEON2) console.log("Install addAll OK " + BC);
			return res;
		}).catch(error => {
			// Une des URLs citées est NOT FOUND, on ne sait pas laquelle
			if (TRACEON) console.log("Install addAll KO " + BC + " - " + error.message);
		})
	);
});

// Suppression des caches obsolètes lors d'une activation
this.addEventListener('activate', function(event) {
	event.waitUntil(
		caches.keys()
		.then(cacheNames => {
				if (TRACEON) console.log("Suppression des caches obsolètes sur activation de " + BC);
				return Promise.all(
					cacheNames.map(cacheName => {
						if (!VCACHES[cacheName]) {
							if (TRACEON) console.log("Suppression de " + cacheName);
							return caches.delete(cacheName);
						}
					})
				);
		}).catch(error => {
			if (TRACEON) console.log("ERREUR sur suppression des caches obsolètes sur activation de " + BC + " - " + error.message);
		})
	);
});

const nf404 = function(m, u) {
	let txt = encoder.encode(m + " : " + u);
	const headers = new Headers();
	headers.append("Content-Type", "text/plain; charset=utf-8");
	headers.append("Cache-control", "no-store");
	headers.append("Content-Length", "" + txt.length);
	return new Response(txt, {status:404, statusText:"Not Found", headers:headers});
}

const infoSW = function() {
	let txt = encoder.encode(JSON.stringify({inb:inb, uib:uib}));
	const headers = new Headers();
	headers.append("Content-Type", "text/plain");
	headers.append("Cache-control", "no-store");
	headers.append("Content-Length", "" + txt.length);
	return new Response(txt, {status:200, statusText:"OK", headers:headers});
}

const fetchTO = async function(req, timeout) {
	let resp;
	try {
		let controller, signal, tim;
		if (timeout) {
			controller = new AbortController();
			signal = controller.signal;
			tim = setTimeout(() => { controller.abort(); }, timeout);
		}
		/*
		 * exception : Cannot construct a Request with a Request whose mode is 'navigate' and a non-empty RequestInit
		 * quand on fetch une page. D'ou ne passer que l'url quand on fetch une ressouce (timeout != 0)
		 */
		resp = await fetch(timeout ? req.url : req, {signal});
//		resp = await fetch(req, {signal});
		if (timeout && tim) 
			clearTimeout(tim);
		if (resp && resp.ok) {
			if (TRACEON2) console.log("fetch OK du serveur : " + req.url);
		} else {
			if (TRACEON) console.log("fetch KO du serveur : " + req.url);
		}
		return resp;
	} catch (e) {
		if (timeout)
			return nf404("Exception : " + e.message + " sur fetch ressource", req.url);
		else
			return resp;
	}
}

// recherche dans les caches : si build recherche au serveur et garde la réponse en cache de la build citée
const fetchFromCaches = async function(req, build) {
	let resp = await caches.match(req);
	if (resp && resp.ok)
		return resp;
	resp = await fetchTO(req.clone(), TIME_OUT_MS);
	if (!resp || !resp.ok || !build)
		return resp;
	let cachename = (cp ? cp : "root") + "_" + build;
	let cache = await caches.open(cachename)
	await cache.put(req.clone, resp.clone);
	return resp;
}

//recherche dans la cache de build : si toCache recherche au serveur et garde la réponse en cache de la build citée
const fetchFromCache = async function(req, build, toCache) {
	let cachename = (cp ? cp : "root") + "_" + build;
	let cache = await caches.open(cachename)
	let resp = await cache.match(req);
	if ((resp && resp.ok) || !toCache)
		return resp;		
	resp = await fetchTO(req.clone(), TIME_OUT_MS);
	if (!resp || !resp.ok)
		return resp;
	await cache.put(req.clone, resp.clone);
	return resp;
}

// recherche en cache de build, si non trouvée 404 si !toCache, cherchée au serveur et mise en cache build
// la réponse est le texte de la page avec le tag <base> modifié
const fetchHome = async function(urlHome, build, toCache, timeout){
	let req = new Request(urlHome);
	let home = await fetchFromCache(new Request(urlHome), build, toCache);
	if (!home || !home.ok)
		return nf404("Page d'accueil non trouvée", req.url);
	let text = await home.text();
	let i = text.indexOf("<base ");
	if (i != -1) {
		let j = text.indexOf(">", i + 7)
		if (j != -1) {
			let deb = text.substring(0, i);
			let fin = text.substring(j + 1);
			let base =  "<base href=\"" + CPUI + build + "/\" data-build=\"" + build + "\">"
			let txt = encoder.encode(deb + base + fin);
			const headers = new Headers();
			headers.append("Content-Type", "text/html");
			headers.append("Cache-control", "no-store");
			headers.append("Content-Length", "" + txt.length);
			return new Response(txt, {status:200, statusText:"OK", headers:headers});
		}
	}
	return nf404("Syntaxe incorrecte de la page d'accueil (<base href ...> ???", req.url);	
}

this.addEventListener('fetch', event => {
	let d = new Date();
	let url = event.request.url;
	if (TRACEON2) console.log("fetch event " + d.toDateString() + " " + d.getMilliseconds + " sur: " + url);
	let i = url.indexOf("//");
	let j = url.indexOf("/", i + 2);
	let site;		// https://localhost:443     jusqu'au / SANS /
	let path;		// ce qui suit le site AVEC /
	if (j != -1) {
		site = url.substring(0, j);
		path = j == url.length - 1 ? "/" : url.substring(j);
	} else {
		path = "/";
		site = url;
	}
	
	if (path == CP + "$infoSW") {
		event.respondWith(infoSW());
		return;
	}

	if (path.startsWith(CP + "$sw")) {
		event.respondWith(fetchTO(event.request, TIME_OUT_MS));
		return;
	}

	if (path.startsWith(CPOP)) {
		event.respondWith(fetchTO(event.request, 0));
		return;
	}

	if (path.startsWith(CPUI)) {
		let p = path.substring(CPUI.length);
		let i = p.indexOf("/");
		let b = i != -1 ? p.substring(0, i) : "";
		event.respondWith(fetchFromCaches(event.request, b != BC ? b : null));
		return;
	}

	if (path.startsWith(CP)) {
		let p = path.substring(CP.length);
		let j = p.lastIndexOf("?");
		let home1 = j == -1 ? p : p.substring(0, j);
		let q = j == -1 ? "" : p.substring(j + 1);
		j = q.lastIndexOf("#");
		q = j == -1 ? q : q.substring(0, j);

		let h = analyseHome(home1, q, shortcuts);
		// {breq:breq, buireq:buireq, org:org, home:home, mode:mode, qs:qs}
		
		if (h.buireq) {
			if (!BUILDS[h.buireq]){
				// build requise et non servie par le script actuel : routée au serveur
				event.respondWith(fetchTO(event.request, TIME_OUT_MS));
				return;		
			} else {
				// build requise et servie par le script actuel : 
				// cherche en cache de la breq, puis au serveur et clone en cache de breq
				let urlHome = site + CPUI + buireq + "/" + h.home + ".html";
				event.respondWith(fetchHome(urlHome, buireq, true, TIME_OUT_MS));
				return;					
			}
		} else {
			// build NON requise et non servie par le script actuel : routée au serveur
			// cherche en cache de BC, si absente 404
			let urlHome = site + CPUI + BC + "/" + h.home + ".html";
			event.respondWith(fetchHome(urlHome, BC, false, TIME_OUT_MS));
			return;								
		}		
	}
	
	event.respondWith(nf404("Syntaxe URL non reconnue", url));
});

const analyseHome = function(home1, q, shortcuts) {
	let i, breq, buireq, org, home, mode;
	
	let qs = {}
	if (q && q.length > 1) {
		q = q.substring(1);
		let args = q.split("&");
		if (args && args.length) {
			for(let i = 0, arg = null; arg = args[i]; i++){
				if (arg) {
					i = arg.indexOf("=");
					if (i == -1 ) qs[arg] = ""; else { if (i) qs[arg[0,i] = arg[i + 1]]; }
				}
			}
			x = qs.build;
			if (x) {
				try {
					breq = [0, 0, 0];
					let y = x.split(".");
					if (y.length >= 1) breq[0] = parseInt(y[0],10);
					if (y.length >= 2) breq[1] = parseInt(y[1],10);
					if (y.length >= 3) breq[2] = parseInt(y[2],10);
					if (breq[0] < 1 || breq[1] < 0 || breq[2] < 0) breq = null; 
				} catch (e) { breq = null;  }
				if (breq) buireq = breq[0] + "." + breq[1];
			}
		}
	}
	
	let home2
	i = home1.lastIndexOf(".");
	if (i == -1) {
		mode = 1;
		home2 = home1;
	} else {
		let ext = home1.substring(i + 1);
		home2 = home1.substring(0, i);
		if (ext.startsWith(".a")) 
			mode = 2;
		else if (ext.startsWith(".i"))
			mode = 0;
		else 
			mode = 1;				
	}

	let orgHome = home2;
	if (!home2)
		orgHome = shortcuts["?"];
	else {
		i = home2.indexOf("-");
		if (i == -1) {
			let x = shortcuts[home2];
			orgHome = x ? x : home2 + "-index";
		}
	}
	i = orgHome.indexOf("-");
	org = orgHome.substring(0, i);
	home = orgHome.substring(i + 1);
	
	return {breq:breq, buireq:buireq, org:org, home:home, mode:mode, qs:qs}
}
