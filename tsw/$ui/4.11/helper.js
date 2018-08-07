message = function() {
	let swa = navigator.serviceWorker && navigator.serviceWorker.controller;
	let d = new Date().toDateString();
	let msg = swa ? "Activé" : "Pas de SW";
	document.getElementById("info").innerText = msg + " " + d;
}

register = function() {
	let swscope = "/tsw/$sw.js";
	navigator.serviceWorker.register(swscope)
	.then(reg => {
		message();
		console.log("reg-ok:" + reg.scope);
	}).catch(err => {
		console.log("reg-KO:" + swscope);	
	})
}

reload = function(b, msg) {	
	const t1 = "<!doctype html><html><head><meta charset='utf-8'></head><body><p id='msg'></p>\n<script>\n";
	const t2 = "document.getElementById('msg').innerText = json.msg + ' ' + json.b + ' (' + json.n + ')';\n";
	const t3 = "setTimeout(function(){ window.location = json.u2 + '?' + encodeURI(JSON.stringify(json));}, 2000);\n</script>\n</body></html>";
	const encoder = new TextEncoder("utf-8");
	let u = "" + window.location;
	json = {url:u, b:b, msg:msg, u2:window.location.origin + "/tsw/$sw.html", n:1};
	let txt = t1 + "json = " + JSON.stringify(json) + ";\n" + t2 + t3;
	// console.log(txt);
	window.location = URL.createObjectURL(new Blob([encoder.encode(txt)], {type : 'text/html'}));
}

infoSW = async function() {
	let json = await getInfoSW();
	document.getElementById("infoSW").innerText = json ? JSON.stringify(json) : "Erreur";
}

getInfoSW = async function() {
	try {
		let controller = new AbortController();
		let signal = controller.signal;
		let tim = setTimeout(() => { controller.abort(); }, 300000);
		const resp = await fetch("http://localhost/tsw/$infoSW", {signal});
		if (tim) clearTimeout(tim);
		if (resp && resp.ok)
			return await resp.json();
		else
			return "";
	} catch(err) {
		return "";
	}
}

// swa = navigator.serviceWorker && navigator.serviceWorker.controller;

register();
