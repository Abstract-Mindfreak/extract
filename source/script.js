function hexToHsl(hex) {
	let r = parseInt(hex.slice(1, 3), 16) / 255,
		g = parseInt(hex.slice(3, 5), 16) / 255,
		b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h,
		s,
		l = (max + min) / 2;
	if (max === min) {
		h = s = 0;
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return [h * 360, s * 100, l * 100];
}
function hslToHex(h, s, l) {
	h = ((h % 360) + 360) % 360;
	s = Math.max(0, Math.min(100, s));
	l = Math.max(0, Math.min(100, l));
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12,
		a = s * Math.min(l, 1 - l);
	const f = (n) =>
		Math.round(
			(l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255
		);
	const r = f(0),
		g = f(8),
		b = f(4);
	return (
		"#" +
		(r < 16 ? "0" : "") +
		r.toString(16) +
		(g < 16 ? "0" : "") +
		g.toString(16) +
		(b < 16 ? "0" : "") +
		b.toString(16)
	);
}
function lum(hex) {
	const f = (c) => {
		c /= 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return (
		0.2126 * f(parseInt(hex.slice(1, 3), 16)) +
		0.7152 * f(parseInt(hex.slice(3, 5), 16)) +
		0.0722 * f(parseInt(hex.slice(5, 7), 16))
	);
}
function contrast(h1, h2) {
	const l1 = lum(h1),
		l2 = lum(h2);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function bestText(hex) {
	return contrast(hex, "#ffffff") >= contrast(hex, "#000000")
		? "#ffffff"
		: "#000000";
}

const HARMONIES = {
	analogous: {
		name: "Analogous",
		desc:
			"Colors that sit next to each other on the wheel. They share a common hue, creating a calm, unified look — like a sunset blending from orange to pink to red.",
		fn: ([h, s, l]) => [
			[h, s, l],
			[h + 22, s * 0.9, Math.min(l + 8, 88)],
			[h - 22, s * 0.9, Math.max(l - 6, 12)],
			[h + 12, s * 0.5, Math.min(l + 28, 90)],
			[h + 8, s * 0.3, Math.min(l + 44, 94)],
			[h - 8, s * 0.8, Math.max(l - 28, 8)]
		]
	},
	complementary: {
		name: "Complementary",
		desc:
			"Two colors directly across from each other on the wheel. High contrast, vibrant tension — think blue and orange, red and green. Perfect for bold, eye-catching designs.",
		fn: ([h, s, l]) => [
			[h, s, l],
			[h + 180, s, l],
			[h + 180, s * 0.7, Math.min(l + 15, 88)],
			[h, s * 0.6, Math.min(l + 30, 90)],
			[h + 180, s * 0.3, Math.min(l + 40, 94)],
			[h, s * 0.8, Math.max(l - 28, 8)]
		]
	},
	triadic: {
		name: "Triadic",
		desc:
			"Three colors equally spaced around the wheel (120° apart). Rich and vibrant while staying balanced — like the classic red, yellow, blue of primary colors.",
		fn: ([h, s, l]) => [
			[h, s, l],
			[h + 120, s, l],
			[h + 240, s, l],
			[h + 120, s * 0.55, Math.min(l + 20, 88)],
			[h + 240, s * 0.4, Math.min(l + 38, 94)],
			[h, s * 0.7, Math.max(l - 25, 8)]
		]
	},
	split: {
		name: "Split Complementary",
		desc:
			"Like complementary, but instead of one opposite color you use the two flanking it. Less tension than full complementary, but still vivid and interesting.",
		fn: ([h, s, l]) => [
			[h, s, l],
			[h + 150, s, l],
			[h + 210, s, l],
			[h + 150, s * 0.5, Math.min(l + 20, 88)],
			[h + 210, s * 0.4, Math.min(l + 38, 94)],
			[h, s * 0.7, Math.max(l - 25, 8)]
		]
	},
	tetradic: {
		name: "Tetradic",
		desc:
			"Four colors forming a rectangle on the wheel. Maximum color variety — great for complex, lively designs. Works best when one color dominates and the others accent.",
		fn: ([h, s, l]) => [
			[h, s, l],
			[h + 90, s, l],
			[h + 180, s, l],
			[h + 270, s, l],
			[h, s * 0.4, Math.min(l + 42, 94)],
			[h + 180, s * 0.6, Math.max(l - 25, 8)]
		]
	},
	mono: {
		name: "Monochromatic",
		desc:
			'All colors share the same hue — only lightness and saturation change. Ultra-cohesive, elegant, and sophisticated. Easiest to make look "designed".',
		fn: ([h, s, l]) => [
			[h, s, l],
			[h, s * 0.85, Math.min(l + 18, 88)],
			[h, s * 0.65, Math.min(l + 34, 92)],
			[h, s * 1.1, Math.max(l - 16, 8)],
			[h, s * 0.4, Math.min(l + 50, 95)],
			[h, s * 0.9, Math.max(l - 32, 5)]
		]
	}
};

const ROLES = ["Primary", "Secondary", "Accent", "Neutral", "Light", "Dark"];
const ROLE_DESC = [
	"Main brand color",
	"Supports primary",
	"Pops & highlights",
	"Text & borders",
	"Backgrounds",
	"Deep contrast"
];

let baseHex = "#e05c2a",
	harmony = "analogous",
	palette = [];

function render() {
	const hsl = hexToHsl(baseHex);
	palette = HARMONIES[harmony].fn(hsl).map(([h, s, l]) => hslToHex(h, s, l));
	document.getElementById("blob1").style.background = palette[0];
	document.getElementById("blob2").style.background = palette[1] || palette[0];
	document.getElementById("blob3").style.background = palette[2] || palette[0];
	renderMiniCards();
	renderWcag();
	renderPreview();
	renderWheel();
	renderDesc();
}

function renderMiniCards() {
	const grid = document.getElementById("miniCards");
	grid.innerHTML = "";
	palette.forEach((hex, i) => {
		const [h, s, l] = hexToHsl(hex),
			tc = bestText(hex);
		const card = document.createElement("div");
		card.className = "mini-card";
		card.innerHTML = `
      <div class="mini-swatch" style="background:${hex}; min-height:52px;">
        <div class="mini-swatch-preview" style="color:${tc}">Aa</div>
        <div class="mini-flash" style="color:${tc}">✓</div>
      </div>
      <div class="mini-info">
        <span class="mini-role">${ROLES[i]} · ${ROLE_DESC[i]}</span>
        <span class="mini-hex">${hex.toUpperCase()}</span>
        <span class="mini-hsl">${Math.round(h)}° ${Math.round(s)}% ${Math.round(
			l
		)}%</span>
      </div>`;
		card.addEventListener("click", () => {
			navigator.clipboard?.writeText(hex.toUpperCase());
			card.classList.add("flash");
			setTimeout(() => card.classList.remove("flash"), 750);
		});
		grid.appendChild(card);
	});
}

function renderWcag() {
	const grid = document.getElementById("wcagGrid");
	grid.innerHTML = "";
	let pass = 0,
		total = 0;
	palette.forEach((hex, i) => {
		const cw = contrast(hex, "#ffffff"),
			cb = contrast(hex, "#000000");
		const best = Math.max(cw, cb);
		total += best;
		if (best >= 4.5) pass++;
		const whitePasses = cw >= 4.5,
			blackPasses = cb >= 4.5;
		const card = document.createElement("div");
		card.className = "wcag-card";
		card.innerHTML = `
      <div class="wcag-sample" style="background:${hex}">
        <div class="sample-text" style="color:#ffffff;opacity:${
									whitePasses ? 1 : 0.2
								}">
          <span class="sample-aa-dot" style="background:${
											whitePasses ? "#22c55e" : "#ef4444"
										}"></span>Aa
        </div>
        <div class="sample-text" style="color:#000000;opacity:${
									blackPasses ? 1 : 0.2
								}">
          <span class="sample-aa-dot" style="background:${
											blackPasses ? "#22c55e" : "#ef4444"
										}"></span>Aa
        </div>
      </div>
      <div class="wcag-card-info">
        <div class="wcag-ratio-row">
          <span class="ratio-item ${
											whitePasses ? "ratio-pass" : "ratio-fail"
										}">⬜ ${cw.toFixed(1)}</span>
          <span class="ratio-item ${
											blackPasses ? "ratio-pass" : "ratio-fail"
										}">⬛ ${cb.toFixed(1)}</span>
        </div>
        <div class="wcag-ratio-label">${ROLES[i]}</div>
      </div>`;
		grid.appendChild(card);
	});
	const avg = (total / palette.length).toFixed(1);
	document.getElementById(
		"wcagStats"
	).innerHTML = `<span><strong>${pass} of 6</strong> pass AA or better</span><span style="margin-left:1rem">Avg: <strong>${avg}:1</strong></span>`;
}

function s(id) {
	return document.getElementById(id);
}
function applyStyles(id, styles) {
	const el = s(id);
	if (!el) return;
	Object.assign(el.style, styles);
}

function renderPreview() {
	if (!palette.length) return;
	const [p0, p1, p2, p3, p4, p5] = palette;
	const tx = (hex) => bestText(hex);

	const navBg = p5;
	const navTx = tx(navBg);
	applyStyles("pvNav", { background: navBg, color: navTx });
	applyStyles("pvNavLogo", { color: navTx });
	applyStyles("pvLogoDot", { background: p2 });
	s("pvNavLinks")
		.querySelectorAll(".pv-nav-link")
		.forEach((el) => (el.style.color = navTx));
	applyStyles("pvNavActive", { color: p2 });
	applyStyles("pvNavCta", { background: p2, color: tx(p2) });

	const heroBg = p0;
	const heroTx = tx(heroBg);
	applyStyles("pvHero", { background: heroBg, color: heroTx });
	applyStyles("pvHeroTag", { color: heroTx });
	applyStyles("pvHeroTitle", { color: heroTx });
	applyStyles("pvHeroBody", { color: heroTx });
	applyStyles("pvBtnPrimary", { background: p2, color: tx(p2) });
	applyStyles("pvBtnGhost", { color: heroTx });
	applyStyles("pvBlob1", { background: p1 });
	applyStyles("pvBlob2", { background: p3 });
	applyStyles("pvRing", { borderColor: heroTx });

	const [h0, sa0, li0] = hexToHsl(p0);
	const statsBg = hslToHex(h0, sa0, Math.max(li0 - 8, 5));
	const statsTx = tx(statsBg);
	applyStyles("pvStats", { background: statsBg, color: statsTx });
	["pvStat1", "pvStat2", "pvStat3"].forEach((id) =>
		applyStyles(id, { color: statsTx })
	);
	["pvStatDiv", "pvStatDiv2"].forEach((id) =>
		applyStyles(id, { background: statsTx })
	);

	applyStyles("pvCardsSection", { background: "rgba(0,0,0,0.05)" });
	[
		["pvThumb1", "pvShape1", "pvCardTag1", p0, p4],
		["pvThumb2", "pvShape2", "pvCardTag2", p1, p4],
		["pvThumb3", "pvShape3", "pvCardTag3", p2, p4]
	].forEach(([th, sh, tg, col, bg]) => {
		applyStyles(th, { background: bg });
		applyStyles(sh, { background: col });
		applyStyles(tg, { color: col });
	});

	applyStyles("pvFormBlock", { background: "#ffffff" });
	applyStyles("pvInput", {
		borderColor: p3 + "55",
		background: p4 + "22",
		color: "var(--ink)"
	});
	applyStyles("pvSubmit", { background: p0, color: tx(p0) });

	applyStyles("pvBadgesBlock", { background: "#fafafa" });
	applyStyles("pvChip1", { background: p0 + "18", color: p0 });
	applyStyles("pvChip2", { background: p1 + "18", color: p1 });
	applyStyles("pvChip3", { background: p2 + "18", color: p2 });
	applyStyles("pvAlert", { background: p1 + "15", color: p1 });
	applyStyles("pvAlertIcon", { color: p2 });
	applyStyles("pvProgressFill", { background: p0 });

	applyStyles("pvFooter", { background: navBg, color: navTx });
	applyStyles("pvFd1", { background: p0 });
	applyStyles("pvFd2", { background: p1 });
	applyStyles("pvFd3", { background: p2 });
}

function drawWheel() {
	const cv = document.getElementById("colorWheel"),
		ctx = cv.getContext("2d");
	const W = cv.width,
		cx = W / 2,
		r = W / 2 - 1;
	for (let a = 0; a < 360; a++) {
		const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
		g.addColorStop(0, `hsl(${a},0%,55%)`);
		g.addColorStop(0.45, `hsl(${a},70%,55%)`);
		g.addColorStop(1, `hsl(${a},100%,38%)`);
		ctx.beginPath();
		ctx.moveTo(cx, cx);
		ctx.arc(cx, cx, r, ((a - 1) * Math.PI) / 180, ((a + 1) * Math.PI) / 180);
		ctx.closePath();
		ctx.fillStyle = g;
		ctx.fill();
	}
	const v = ctx.createRadialGradient(cx, cx, r * 0.65, cx, cx, r);
	v.addColorStop(0, "rgba(0,0,0,0)");
	v.addColorStop(1, "rgba(0,0,0,0.2)");
	ctx.beginPath();
	ctx.arc(cx, cx, r, 0, Math.PI * 2);
	ctx.fillStyle = v;
	ctx.fill();
}

function renderWheel() {
	const c = document.getElementById("wheelDots");
	c.innerHTML = "";
	const W = 80,
		cx = W / 2;
	palette.forEach((hex) => {
		const [h, s] = hexToHsl(hex);
		const R = cx * Math.min(s / 100, 1) * 0.82,
			rad = ((h - 90) * Math.PI) / 180;
		const dot = document.createElement("div");
		dot.className = "w-dot";
		dot.style.left = cx + Math.cos(rad) * R + "px";
		dot.style.top = cx + Math.sin(rad) * R + "px";
		dot.style.background = hex;
		c.appendChild(dot);
	});
}

function renderDesc() {
	const d = HARMONIES[harmony];
	document.getElementById(
		"harmonyDesc"
	).innerHTML = `<h3>${d.name}</h3><p>${d.desc}</p>`;
}

document.getElementById("baseColor").addEventListener("input", (e) => {
	baseHex = e.target.value;
	document.getElementById("hexInput").value = baseHex;
	render();
});
document.getElementById("hexInput").addEventListener("input", (e) => {
	let v = e.target.value.trim();
	if (!v.startsWith("#")) v = "#" + v;
	if (/^#[0-9a-fA-F]{6}$/.test(v)) {
		baseHex = v;
		document.getElementById("baseColor").value = v;
		render();
	}
});
document.getElementById("harmonyPills").addEventListener("click", (e) => {
	const btn = e.target.closest(".pill");
	if (!btn) return;
	document
		.querySelectorAll(".pill")
		.forEach((p) => p.classList.remove("active"));
	btn.classList.add("active");
	harmony = btn.dataset.h;
	render();
});
document.getElementById("randBtn").addEventListener("click", () => {
	const h = Math.random() * 360,
		s = 40 + Math.random() * 50,
		l = 28 + Math.random() * 40;
	baseHex = hslToHex(h, s, l);
	document.getElementById("baseColor").value = baseHex;
	document.getElementById("hexInput").value = baseHex;
	render();
});

drawWheel();
render();
