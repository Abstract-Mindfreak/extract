// CSS version logic:
//
// 1. Elements AFTER the hovered one (i > hoverIndex) move RIGHT by:
//    min(15px * (remaining elements count), overlapOffset)
// 2. Elements BEFORE the hovered one (i < hoverIndex) move LEFT by:
//    -min(15px * (index), overlapOffset)
// 3. The hovered element itself (i === hoverIndex) stays put
//
// 15px is the "push force" - each element pushes others by this amount
// overlapOffset caps the movement to prevent excessive overlapping

const list = document.querySelector(".horizontal-stack");

const modernCSS =
    CSS.supports("sibling-index()", "0") ||
    CSS.supports("sibling-count()", "0");

if (!modernCSS) {
    initFallback(list);
}

function initFallback(list) {
    const items = [...list.querySelectorAll(".item")];
    const total = items.length;

    items.forEach((item, i) => {
        item.style.setProperty("--bg-color", `oklch(80% 0.15 ${(i + 1) * 30})`);
    });

    const getSizes = () => items.map((item) => item.offsetWidth);

    const applyTransform = (hoverIndex) => {
        const sizes = getSizes();
        for (const [i, item] of items.entries()) {
            const overlapOffset = sizes[i] / 2;

            const move =
                i > hoverIndex
                    ? Math.min(15 * (total - i - 1), overlapOffset) // Move right
                    : i < hoverIndex
                    ? -Math.min(15 * i, overlapOffset) // Move left
                    : 0;

            const transform = move ? `translateX(${move}px)` : "";

            if (item.style.transform !== transform) {
                item.style.transform = transform;
            }
        }
    };

    const resetTransforms = () => {
        items.forEach((item) => (item.style.transform = ""));
    };

    let frame;

    const start = (fn) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(fn);
    };

    list.addEventListener(
        "mouseenter",
        (e) => {
            const item = e.target.closest(".item");
            if (!item) return;

            const hoverIndex = items.indexOf(item);
            start(() => applyTransform(hoverIndex));
        },
        true
    );

    list.addEventListener("mouseleave", () => {
        start(resetTransforms);
    });
}