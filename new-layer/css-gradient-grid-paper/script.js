const q$ = document.querySelector.bind(document);
const q$a = document.querySelectorAll.bind(document);


/* handle range values */

const $gap = q$('#grid-gap');
const $opacity = q$('#grid-opacity');
const $hue = q$('#grid-hue');
const $body = q$('body');

$gap.addEventListener('input', (ev) => {
    const v = $gap.value;
    $body.style.setProperty('--grid-gap', v + 'px');
});

$opacity.addEventListener('input', (ev) => {
    const v = $opacity.value;
    $body.style.setProperty('--grid-opacity', v );
});

$hue.addEventListener('input', (ev) => {
    const v = $hue.value;
    $body.style.setProperty('--grid-hue', v );
});



/* handle theme toggle */

const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
const $themeToggle = document.querySelector('#theme-toggle');
$themeToggle.checked = prefersDarkMode;
const setTheme = () => {
    document.body.classList.add('themed');
    document.body.toggleAttribute('is-dark', $themeToggle.checked);
}
$themeToggle.addEventListener('change', setTheme);
setTheme();