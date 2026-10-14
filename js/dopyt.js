// Adresa funkcie, ktorá prijme a uloží nezáväzný dopyt. Ak sa zmení, stačí ju prepísať tu.
const DOPYT_URL = "https://fmkralairvdhjnsfhcxo.supabase.co/functions/v1/dopyt";

/* Artenz – odoslanie formulára Nezáväzný dopyt (#dopyt-form) */
(function () {
	var form = document.getElementById("dopyt-form");
	if (!form) return;

	// Čas načítania stránky. Funkcia podľa neho spozná roboty, preto nejde o čas odoslania.
	var loadedAt = Date.now();

	var HLASKY = {
		missing_name: "Vyplňte meno a\u00A0priezvisko.",
		missing_phone: "Vyplňte telefónne číslo.",
		missing_email: "Vyplňte e-mailovú adresu.",
		invalid_email: "E-mailová adresa nevyzerá správne.",
		invalid_phone: "Telefónne číslo nevyzerá správne.",
		invalid_event_date: "Dátum akcie nie je platný.",
		invalid_guests: "Počet hostí zadajte ako číslo.",
		too_long: "Text je príliš dlhý, skráťte ho.",
		turnstile_failed: "Overenie zlyhalo, obnovte stránku a\u00A0skúste to znova.",
		invalid_json: "Dopyt sa nepodarilo odoslať, skúste to znova.",
	};
	var OVERENIE_NEDOKONCENE = "Počkajte na dokončenie overenia a\u00A0odošlite dopyt znova.";
	var CHYBA_VSEOBECNA = "Dopyt sa nepodarilo odoslať. Zavolajte nám na ";
	var CHYBA_SERVERA = "Skúste to o\u00A0chvíľu znova alebo nám zavolajte na ";
	var DAKUJEME = "Ďakujeme, ozveme sa vám do 24 hodín.";
	var ODOSIELAM = "Odosielam…";
	var TELEFON = { text: "0948 10 33 10", href: "tel:+421948103310" };
	var CAKANIE_MS = 20000;

	var polia = form.elements;
	var tlacidlo = form.querySelector('button[type="submit"]');
	var popisTlacidla = tlacidlo.querySelector(".btn-double-text");
	var textTlacidla = popisTlacidla.textContent;
	var chybaCelkova = document.getElementById("dopyt-chyba");
	var chybaOverenia = document.getElementById("dopyt-turnstile-chyba");
	var stav = document.getElementById("dopyt-stav");

	// dátum akcie nemôže byť v minulosti
	var dnes = new Date();
	polia.event_date.min = dnes.getFullYear() + "-" + ("0" + (dnes.getMonth() + 1)).slice(-2) + "-" + ("0" + dnes.getDate()).slice(-2);

	// bez JavaScriptu je tlačidlo vypnuté, aby sa údaje neodoslali inam
	tlacidlo.disabled = false;

	function chybovyPrvok(pole) {
		return document.getElementById(pole.getAttribute("aria-describedby"));
	}

	function vycistiChyby() {
		Array.prototype.forEach.call(form.querySelectorAll(".is-invalid"), function (pole) {
			pole.classList.remove("is-invalid");
			pole.removeAttribute("aria-invalid");
			chybovyPrvok(pole).textContent = "";
		});
		chybaOverenia.textContent = "";
		chybaCelkova.textContent = "";
	}

	// zvýrazní pole a zobrazí pri ňom hlášku; vráti pole, alebo null, ak také pole nie je
	function oznacPole(nazov, kod) {
		var pole = nazov ? polia.namedItem(nazov) : null;
		if (!pole || !pole.getAttribute("aria-describedby")) return null;
		pole.classList.add("is-invalid");
		pole.setAttribute("aria-invalid", "true");
		chybovyPrvok(pole).textContent = HLASKY[kod] || HLASKY.invalid_json;
		return pole;
	}

	function zobrazChybu(text, sTelefonom) {
		chybaCelkova.textContent = text;
		if (!sTelefonom) return;
		var odkaz = document.createElement("a");
		odkaz.href = TELEFON.href;
		odkaz.textContent = TELEFON.text;
		chybaCelkova.appendChild(odkaz);
		chybaCelkova.appendChild(document.createTextNode("."));
	}

	function skontroluj() {
		var chyby = [];
		var telefon = polia.phone.value.trim();
		var email = polia.email.value.trim();
		var hostia = polia.guests;

		if (!polia.name.value.trim()) chyby.push(["name", "missing_name"]);
		if (!telefon) chyby.push(["phone", "missing_phone"]);
		else if ((telefon.match(/\d/g) || []).length < 6) chyby.push(["phone", "invalid_phone"]);
		if (!email) chyby.push(["email", "missing_email"]);
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) chyby.push(["email", "invalid_email"]);
		if (polia.event_date.validity.badInput || polia.event_date.validity.rangeUnderflow) chyby.push(["event_date", "invalid_event_date"]);
		if (hostia.validity.badInput || (hostia.value !== "" && !(/^\d+$/.test(hostia.value) && Number(hostia.value) >= 1))) chyby.push(["guests", "invalid_guests"]);
		["name", "phone", "email", "message"].forEach(function (nazov) {
			var pole = polia[nazov];
			if (pole.maxLength > 0 && pole.value.length > pole.maxLength) chyby.push([nazov, "too_long"]);
		});
		return chyby;
	}

	function odosielanie(zapnute) {
		var text = zapnute ? ODOSIELAM : textTlacidla;
		tlacidlo.disabled = zapnute;
		form.setAttribute("aria-busy", zapnute ? "true" : "false");
		popisTlacidla.textContent = text;
		popisTlacidla.setAttribute("data-text", text);
	}

	// po chybe ostávajú údaje v poliach; token Turnstile platí len raz, preto sa overenie spustí znova
	function poChybe() {
		odosielanie(false);
		if (window.turnstile) {
			try {
				window.turnstile.reset();
			} catch (e) {}
		}
	}

	function poUspechu() {
		form.hidden = true;
		stav.textContent = DAKUJEME;
		stav.focus();
	}

	form.addEventListener("submit", function (udalost) {
		udalost.preventDefault();
		if (tlacidlo.disabled) return;
		tlacidlo.disabled = true;
		vycistiChyby();

		var chyby = skontroluj();
		if (chyby.length) {
			var prvePole = null;
			chyby.forEach(function (chyba) {
				var pole = oznacPole(chyba[0], chyba[1]);
				if (!prvePole) prvePole = pole;
			});
			tlacidlo.disabled = false;
			if (prvePole) prvePole.focus();
			return;
		}

		var poleTokenu = form.querySelector('[name="cf-turnstile-response"]');
		var token = poleTokenu ? poleTokenu.value : "";
		if (!token) {
			if (window.turnstile) chybaOverenia.textContent = OVERENIE_NEDOKONCENE;
			else zobrazChybu(CHYBA_VSEOBECNA, true);
			tlacidlo.disabled = false;
			return;
		}

		var data = {
			name: polia.name.value.trim(),
			phone: polia.phone.value.trim(),
			email: polia.email.value.trim(),
			event_type: polia.event_type.value,
			event_date: polia.event_date.value,
			guests: polia.guests.value === "" ? "" : Number(polia.guests.value),
			message: polia.message.value.trim(),
			website: polia.website.value,
			loaded_at: loadedAt,
			turnstile_token: token,
		};

		odosielanie(true);
		var prerusenie = window.AbortController ? new AbortController() : null;
		var casovac = setTimeout(function () {
			if (prerusenie) prerusenie.abort();
		}, CAKANIE_MS);

		fetch(DOPYT_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
			signal: prerusenie ? prerusenie.signal : undefined,
		})
			.then(function (odpoved) {
				return odpoved.json().then(
					function (telo) {
						return { kod: odpoved.status, telo: telo };
					},
					function () {
						return { kod: odpoved.status, telo: null };
					}
				);
			})
			.then(function (vysledok) {
				clearTimeout(casovac);
				// pri 200 web nerozlišuje, či funkcia dopyt uložila, alebo ho ticho zahodila ako robota
				if (vysledok.kod === 200) return poUspechu();

				var telo = vysledok.telo || {};
				if (vysledok.kod === 400 && telo.error) {
					if (telo.error === "turnstile_failed") {
						chybaOverenia.textContent = HLASKY.turnstile_failed;
					} else {
						var pole = oznacPole(telo.field, telo.error);
						if (pole) pole.focus();
						else zobrazChybu(HLASKY[telo.error] || HLASKY.invalid_json, false);
					}
				} else if (vysledok.kod >= 500) {
					zobrazChybu(CHYBA_SERVERA, true);
				} else {
					// 403 forbidden_origin, 405 method_not_allowed a ostatné
					zobrazChybu(CHYBA_VSEOBECNA, true);
				}
				poChybe();
			})
			.catch(function () {
				// funkcia neodpovedala (výpadok siete, časový limit, CORS)
				clearTimeout(casovac);
				zobrazChybu(CHYBA_VSEOBECNA, true);
				poChybe();
			});
	});
})();
