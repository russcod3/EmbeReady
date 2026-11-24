import S, { getLanguage } from '../strings.js';
import { escapeHtml } from './utils.js';

// Copy reviewed and approved by the user before implementation.
const FAQ = {
    en: [
        ['What does EmbeReady cover?', 'Community fire hazards and reports within Batangas City.'],
        ['How do the level buttons work?', 'Each level switches independently. A glowing level is shown. Its × button hides that level. All shows every level if any is off; tapping All when all are on hides them. Barangay and category choices also limit the results. Clear filters restores every level and clears those choices.'],
        ['Why are no hazards showing?', 'All levels may be off, or no reports match your filters. Turn on a level or use Clear filters.'],
        ['How do I report a hazard?', 'Select Live fire, High, Moderate, or Low and pin the location. Non-live reports also collect a category and observations, with an optional photo. No login is required.'],
        ['What do the assessments mean?', 'They summarize reported conditions and preparedness guidance. A risk score helps prioritize attention; it is not a prediction of fire or an official BFP rating. New non-live reports request Gemini assessment; unavailable results require an explicit retry.'],
        ['What does DEMO DATA mean?', 'It identifies example records. Pre-seeded assessments are labeled separately from results produced by Gemini.'],
        ['Does Alert contact responders automatically?', 'No. It opens contact details for you to copy or call manually. Contacts that have not been configured cannot be called through the site.']
    ],
    tl: [
        ['Ano ang sakop ng EmbeReady?', 'Mga panganib sa sunog at mga ulat ng komunidad sa loob ng Batangas City.'],
        ['Paano gamitin ang mga antas?', 'Magkakahiwalay ang mga switch ng bawat antas. Ipinapakita ang antas na may glow. Itinatago ito ng × button nito. Ipinapakita ng Lahat ang bawat antas kung may naka-off; kung lahat ay naka-on, itinatago nito ang lahat. Nililimitahan din ng piniling barangay at uri ang mga resulta. Ibinabalik ng I-reset ang mga filter ang lahat ng antas at inaalis ang mga piniling iyon.'],
        ['Bakit walang ipinapakitang panganib?', 'Maaaring naka-off ang lahat ng antas, o walang ulat na tumutugma sa mga filter. I-on ang isang antas o pindutin ang I-reset ang mga filter.'],
        ['Paano mag-ulat ng panganib?', 'Piliin ang May sunog, Mataas, Katamtaman, o Mababa at i-pin ang lokasyon. Para sa ulat na walang kasalukuyang sunog, ilagay din ang uri at mga obserbasyon; maaari ring magdagdag ng larawan. Hindi kailangan ng login.'],
        ['Ano ang ibig sabihin ng mga pagsusuri?', 'Ibinubuod ng mga ito ang iniulat na kondisyon at gabay sa paghahanda. Ang risk score ay tumutulong sa pagbibigay-prayoridad; hindi ito hula ng sunog o opisyal na rating ng BFP. Humihiling ng pagsusuri sa Gemini ang mga bagong ulat na walang kasalukuyang sunog; kailangang pindutin ang Subukan muli kapag hindi magamit ang resulta.'],
        ['Ano ang ibig sabihin ng DEMO DATA?', 'Tumutukoy ito sa mga halimbawang tala. May hiwalay na label ang mga nakahandang pagsusuri at ang mga resultang ginawa ng Gemini.'],
        ['Awtomatikong kinokontak ba ng Alert ang mga responder?', 'Hindi. Binubuksan nito ang mga detalye ng contact upang ikaw ang kumopya o tumawag. Hindi matatawagan sa site ang mga contact na hindi pa nakatakda.']
    ]
};

export function initFaq() {
    const dialog = document.getElementById('faq-dialog');
    const content = document.getElementById('faq-content');
    const render = () => {
        const open = new Set([...content.querySelectorAll('details')].filter(item => item.open).map(item => item.dataset.faq));
        document.getElementById('faq-title').textContent = S.help.title;
        dialog.querySelector('.faq-close').setAttribute('aria-label', S.help.close);
        content.innerHTML = FAQ[getLanguage()].map(([question, answer], index) =>
            `<details data-faq="${index}" ${open.has(String(index)) ? 'open' : ''}><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`
        ).join('');
    };
    document.querySelectorAll('[data-open-faq]').forEach(button => button.addEventListener('click', () => {
        render();
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) button.animate([{transform:'scale(1)'},{transform:'scale(.91,1.07)'},{transform:'scale(1)'}],{duration:400,easing:'cubic-bezier(.3,1.15,.5,1)'});
        if (!dialog.open) dialog.showModal();
        delete dialog.dataset.closing;
    }));
    const close = () => {
        if (dialog.dataset.closing) return;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { dialog.close(); return; }
        dialog.dataset.closing='true';
        const animation=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(12px) scale(.98)'}],{duration:180,fill:'forwards'});
        animation.finished.then(()=>{dialog.close();animation.cancel();delete dialog.dataset.closing;});
    };
    dialog.querySelector('.faq-close').addEventListener('click', close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click', event => { if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    } });
    window.addEventListener('language:changed', render);
    render();
}
