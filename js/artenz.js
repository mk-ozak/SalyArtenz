/* Artenz – vlastné skripty webu */

// Panely sál (stack-box): od šírky 1200 px sa panely pri skrolovaní prekrývajú a každý má výšku okna.
// Ak sa text niektorého panelu nezmestí do okna tak, aby jeho vrch nebol pod hlavičkou,
// pridá sa trieda stack-box-auto (css/artenz.css) a panely sa zobrazia pod sebou s výškou podľa obsahu.
(function () {
	var box = document.querySelector(".stack-box");
	if (!box) return;
	var desktop = window.matchMedia("(min-width: 1200px)");

	function fitStackBox() {
		box.classList.remove("stack-box-auto");
		if (!desktop.matches) return;
		var header = document.querySelector("header nav");
		var space = window.innerHeight - 2 * (header ? header.offsetHeight : 0);
		var cols = box.querySelectorAll(".stack-item .full-screen > .col-lg-6:not(.cover-background)");
		for (var i = 0; i < cols.length; i++) {
			if (cols[i].offsetHeight > space) {
				box.classList.add("stack-box-auto");
				return;
			}
		}
	}

	var resizeTimer;
	window.addEventListener("resize", function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(fitStackBox, 150);
	});
	window.addEventListener("load", fitStackBox);
	if (document.fonts) document.fonts.ready.then(fitStackBox);
	fitStackBox();
})();
