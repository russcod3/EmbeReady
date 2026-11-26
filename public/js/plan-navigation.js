export function initPlanNavigation(root) {
    const rail = root.querySelector('.plan-tabs-shell');
    if (!rail) return () => {};
    const tabs = rail.querySelector('.plan-tabs');
    const arrows = [...rail.querySelectorAll('[data-plan-scroll]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
        const maximum = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
        rail.dataset.canLeft = String(tabs.scrollLeft > 2);
        rail.dataset.canRight = String(tabs.scrollLeft < maximum - 2);
        arrows[0].disabled = tabs.scrollLeft <= 2;
        arrows[1].disabled = tabs.scrollLeft >= maximum - 2;
    };
    const scroll = event => tabs.scrollBy({ left: Number(event.currentTarget.dataset.planScroll) * Math.max(110, tabs.clientWidth * .65), behavior: reduced.matches ? 'auto' : 'smooth' });
    arrows.forEach(arrow => arrow.addEventListener('click', scroll));
    tabs.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(tabs);
    update();
    return () => { observer.disconnect(); tabs.removeEventListener('scroll', update); arrows.forEach(arrow => arrow.removeEventListener('click', scroll)); };
}
