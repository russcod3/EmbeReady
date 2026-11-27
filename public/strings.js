/**
 * public/strings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All user-facing UI strings for EmbeReady.
 * Shared English and Tagalog interface copy. Reported observations and saved
 * assessment prose remain in their original language.
 *
 * Usage (app.js):
 *   import S from './strings.js';
 *   element.textContent = S.landing.title;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const EN_STRINGS = {

    // ── App identity ─────────────────────────────────────────────────────────
    app: {
        name:           'EmbeReady',
        tagline:        'Community Fire Hazard & Risk Map',
        city:           'Batangas City, Batangas, Philippines',
        coords:         '13.7565°N  121.0583°E',
        demoBadge:      'DEMO DATA',
        liveBadge:      'LIVE',
        aiLabel:        'AI-generated',
        pendingLabel:   'Awaiting Gemini'
    },

    // ── Landing / Search ──────────────────────────────────────────────────────
    landing: {
        eyebrow:        'Batangas City Fire Hazard Watch',
        title:          'Find fire hazards\nin your area.',
        subtitle:       'Search a barangay, street, or landmark in Batangas City to load the community hazard map.',
        inputPlaceholder: 'Search barangay, street, landmark…',
        searchBtn:      'Search',
        quickLabel:     'Quick jump:',
        exploreBtn:     'View full city map',
        outOfBoundsMsg: 'EmbeReady currently covers Batangas City only.',
        noResultsMsg:   'No results found. Try a barangay name or landmark.',
        offlineFallback:'Network unavailable — searching local database.',
    },

    // ── Map & filters ─────────────────────────────────────────────────────────
    map: {
        legendTitle:    'Risk Level',
        low:            'Low',
        moderate:       'Moderate',
        heavy:          'High',
        filterAll:      'All',
        filterLive:     'Live',
        liveCounter:    (n) => n === 1 ? '1 active fire' : `${n} active fires`,
        liveTimerLabel: 'Started',
        minutesAgo:     (m) => `${m}m ago`,
        hoursAgo:       (h) => `${h}h ago`,
        loadingMarkers: 'Loading hazards…',
        noHazards:      'No hazards match the current filters.',
        filterPanel:    'Filter hazards',
        filterLevel:    'Risk level',
        filterCategory: 'Category',
        filterBarangay: 'Barangay',
        filterStatus:   'Status',
        resetFilters:   'Clear filters',
        applyFilters:   'Apply',
        liveCount:      n => `${n} Live`,
        exploreTitle:   'Explore Batangas City',
        exploreSubtitle:'Community fire hazard map · No account needed',
        filtersLayers:  'Filters & layers',
        filterHint:     'A glowing level is visible. Tap a level to switch it on or off, or use × to hide it. All shows every level; tap it again to hide all.',
        emptyState:     'No hazards shown. Tap a level to see them',
        tipTitle:       'Choose what you see',
        tipText:        'A glow means a level is shown. Use its × to hide it. Tap any level to turn it on or off. All shows every level, or hides them when all are on.',
        dismissTip:     'Got it',
        showAll:        'Show all hazard levels',
        hideAll:        'Hide all hazard levels',
        allBarangays:   'All Barangays',
        allCategories:  'All Categories',
        reportSaved:    'Report saved on the map.',
        reportHazard:   'Report hazard',
        infrastructure: 'Infrastructure',
        hydrants:       'Hydrants',
        hospitals:      'Hospitals',
        fireStations:   'Fire Depts',
        expandPanel:    'Expand panel',
        collapsePanel:  'Collapse panel',
        retry:          'Retry',
        assessing:     (completed, total) => `Assessing hazards · ${completed}/${total}`,
        awaiting:      (completed, unavailable) => `${completed} reports ready · ${unavailable} awaiting assessment`,
        ready:         n => `${n} assessments ready`,
        progressError: 'Could not check assessment progress',
    },

    // ── Detail drawer ─────────────────────────────────────────────────────────
    drawer: {
        verification: { verified: 'Verified', unverified: 'Unverified' },
        closeBtn:       'Close',
        scrollPlanLeft: 'Show earlier preparedness tabs',
        scrollPlanRight:'Show more preparedness tabs',
        reportedLevel:  'Reported level',
        assessedLevel:  'AI-assessed level',
        statusLabel:    'Status',
        barangayLabel:  'Barangay',
        addressLabel:   'Address',
        categoryLabel:  'Hazard type',
        descLabel:      'Description',
        photoAlt:       'Hazard site photo',
        photoSlot:      'NO PHOTO RECORDED — FIELD SLOT OPEN',
        historyTitle:   'Fire history at this location',
        noHistory:      'No incident records supplied for this report.',
        aiSectionTitle: 'Risk Assessment',
        planTitle:      'Preparedness Plan',
        tabBefore:      'Before',
        tabDuring:      'During',
        tabAfter:       'After',
        tabEvacuation:  'Evacuation',
        tabProhibited:  'What NOT to do',
        contactsTitle:  'Emergency Contacts',
        callBtn:        (name) => `Call ${name}`,
        placeholderWarn:'Contact number not yet configured',
        confidenceHigh: 'High confidence',
        confidenceMed:  'Medium confidence',
        confidenceLow:  'Low confidence',
        scoreLabel:     'Risk score',
        factorScore:    (score, max) => `${score} / ${max}`,
        engineAI:       'AI-generated assessment',
        enginePending:  'Gemini assessment unavailable',
        preSeeded:      'Pre-seeded assessment',
        gemini:         'Assessed by Gemini',
        guidance:       'Preparedness guidance',
        geminiGuidance: 'Gemini guidance',
        locationTitle:  'Location & Description',
        classification:'Classification',
        coordinates:   'Coordinates',
        photoUnavailable:'Photo not yet available',
        photoHint:      'The site owner can add a photo here.',
        preparedness:   'Community Preparedness Plan',
        context:        'Barangay context',
        evacuationSite:'Designated evacuation site',
        moreEvidence:   'More evidence needed',
        risk:           'risk',
        confidence:     'confidence',
        reporterSelected:'Reporter-selected',
        unavailable:    'Assessment unavailable',
        assessing:      'Gemini is assessing this hazard',
        liveReported:   'Live fire reported',
        liveHelp:       'Use the responder contacts below to call for help.',
        retryHelp:      'The report is saved. Retry assessment from the map controls. No generated score is available.',
        assessingHelp:  'The risk breakdown and precautions will appear here automatically. You can keep exploring the map.',
        disclaimer:     'Prioritisation index · not a probability of fire.',
        rangeNote:      'Estimated range reflects missing observations.',
        immediate:      'Immediate attention recommended.',
        unknown:        'Still unknown',
        noSteps:        'No instructions recorded for this phase.',
        call:           'Call',
        unconfigured:   'Not configured',
        loading:        'Loading hazard…',
        preparing:      'Preparing the report details',
        loadFailed:     'Failed to load hazard',
    },

    // ── Report form ───────────────────────────────────────────────────────────
    report: {
        sectionTitle:   'Report a Hazard or Risk',
        sectionSub:     'All reports appear on the map after submission. No login required.',
        titleLabel:     'Hazard title',
        titlePlaceholder: 'Brief description of the hazard',
        categoryLabel:  'Hazard type',
        levelLabel:     'Risk level',
        statusLabel:    'Reporting status',
        statusPotential:'Potential hazard (not currently on fire)',
        statusActive:   'Active fire or emergency right now',
        locationLabel:  'Location',
        addressLabel:   'Address / street / landmark',
        addressPlaceholder: 'e.g. Near the market, along Rizal Ave',
        barangayLabel:  'Barangay',
        barangayDefault:'Select a barangay',
        pinInstructions:'Click the map to drop a pin, or drag the pin to the exact location.',
        descLabel:      'Description',
        descPlaceholder:'Describe what you observed. Include any details that help BFP respond.',
        photoLabel:     'Photo (optional)',
        photoHint:      'JPG, PNG, or WebP — max 5 MB',
        submitBtn:      'Submit Report',
        submitting:     'Submitting…',
        errorTitle:     'Please correct the following:',
        successTitle:   'Report Submitted',
        refLabel:       'Reference number',
        aiResultTitle:  'AI Risk Assessment',
        actionPrompt:   'What would you like to do next?',
        actionBFP:      'Report to BFP Batangas City',
        actionBarangay: 'Report to Barangay Hall',
        actionDone:     'Done',
        smsPrefix:      'EmbeReady Report',
        smsDivider:     '—',
        closeModal:     'Close',
    },

    // ── Category labels ───────────────────────────────────────────────────────
    categories: {
        faulty_wiring:       'Faulty / Overloaded Wiring',
        lpg_storage:         'LPG / Gas Storage',
        dry_grass:           'Dry Grass / Brush',
        overloaded_outlets:  'Overloaded Electrical Outlets',
        blocked_exit:        'Blocked Fire Exit',
        illegal_burning:     'Illegal / Open Burning',
        informal_settlement: 'Informal Settlement',
        flammable_storage:   'Flammable Material Storage',
        other:               'Other'
    },

    // ── Status labels ─────────────────────────────────────────────────────────
    statuses: {
        potential:  'Potential Hazard',
        active:     'Active Fire',
        contained:  'Contained',
        resolved:   'Resolved'
    },

    // ── Error messages ────────────────────────────────────────────────────────
    errors: {
        networkError:   'Unable to connect to the server. Check your connection.',
        serverError:    'Server error. Please try again.',
        loadFailed:     'Failed to load hazard data.',
        uploadError:    'Photo upload failed. Please try again.',
        rateLimited:    'Too many reports from this device. Please wait 15 minutes.',
    },
    factors: {
        title: 'Behind the score', cards: 'Risk factor cards', factor: 'Factor',
        next: 'Next risk factor', previous: 'Previous risk factor', show: 'Show',
        unknown: 'Unknown', more: 'More observations needed', contribution: 'Contribution to overall risk',
        outOf: n => `out of ${n}`, unscored: 'Not scored · evidence missing',
        points: (score, max) => `${score} / ${max} points · ${Math.round(score / max * 100)}% of this factor’s maximum`,
        labels: { ignition_sources:'Ignition', fuel_combustibles:'Combustible materials', proximity_to_people:'People exposed', structure_material:'Fire spread', escape_routes:'Escape routes', truck_access:'Responder access', fire_history:'Fire history', weather_seasonal:'Environment', human_behavior:'Unsafe practices', safeguards:'Safety measures' }
    },
    welcome: {
        eyebrow: 'A safer community starts with us', heading: 'Welcome to', accent: 'EmbeReady.',
        intro: 'I’m Ember, your fire safety companion. Explore nearby fire hazards, understand the risks, and help keep Batangas City informed.',
        features: ['Community reports', 'Gemini risk insights', 'No account needed'],
        search: 'Jump to a barangay or landmark', greeting: 'Hi! I’m Ember.',
        explore: 'Go to the fire hazard map', note: 'Explore. Report. Be ready.',
        pauseMotion: 'Pause animations', resumeMotion: 'Play animations',
        madeFor: 'Made for Batangas City', footer: 'Local awareness. Shared preparedness.'
    },
    help: { faq: 'FAQ', title: 'Frequently asked questions', close: 'Close FAQ', language: 'Language' }
};

EN_STRINGS.ember = { greeting:'Hi, I’m Ember.', idle:'Tap a map marker to explore its report and safety guidance.', saved:'Your report is saved. Contact responders directly if needed.', thinking:'Your report is being assessed.', hello:'Hello! I’m here to help you explore the map.', walking:'Ready to explore? Choose a barangay or tap a marker.', paused:'Motion off · system preference', resume:'Resume mascot motion', pause:'Pause mascot motion', wave:'Wave hello to Ember' };

// Dictionary-checked vocabulary: antas, katamtaman, ipakita, itago.
// https://diksiyonaryo.ph/search/antas
// https://diksiyonaryo.ph/search/katamtaman
// https://www.tagaloglang.com/ipakita/
const TL_STRINGS = {
    ...EN_STRINGS,
    app: { ...EN_STRINGS.app, tagline:'Mapa ng panganib sa sunog sa komunidad', pendingLabel:'Naghihintay sa Gemini' },
    landing: { ...EN_STRINGS.landing, searchBtn:'Hanapin', inputPlaceholder:'Hanapin ang barangay, kalye, o palatandaan…', noResultsMsg:'Walang nahanap. Subukan ang pangalan ng barangay o palatandaan.', outOfBoundsMsg:'Batangas City pa lamang ang sakop ng EmbeReady.' },
    map: {
        ...EN_STRINGS.map,
        legendTitle:'Antas ng panganib', low:'Mababa', moderate:'Katamtaman', heavy:'Mataas', filterAll:'Lahat', filterLive:'May sunog',
        liveCount:n => `${n} may sunog`, liveCounter:n => `${n} kasalukuyang sunog`,
        exploreTitle:'Tuklasin ang Batangas City', exploreSubtitle:'Mapa ng panganib sa sunog · Hindi kailangan ng account',
        filtersLayers:'Mga filter at layer', filterLevel:'Antas ng panganib', filterCategory:'Uri', filterBarangay:'Barangay',
        filterPanel:'Mga filter ng panganib', resetFilters:'I-reset ang mga filter',
        filterHint:'Ipinapakita ang antas na may glow. Pindutin ang antas para ipakita o itago ito, o gamitin ang × para itago ito. Ipinapakita ng Lahat ang bawat antas; pindutin muli para itago ang lahat.', emptyState:'Walang ipinapakitang panganib. Pumili ng antas para makita ang mga ito',
        tipTitle:'Piliin ang makikita sa mapa', tipText:'Ipinapakita ang antas na may glow. Pindutin ang × para itago ito. Pindutin ang antas para ipakita o itago ito. Ipinapakita ng Lahat ang bawat antas; kung lahat ay naka-on, itinatago nito ang lahat.',
        dismissTip:'Naintindihan ko', showAll:'Ipakita ang lahat ng antas', hideAll:'Itago ang lahat ng antas',
        allBarangays:'Lahat ng Barangay', allCategories:'Lahat ng Uri', reportSaved:'Na-save ang ulat sa mapa.', reportHazard:'Mag-ulat ng panganib',
        infrastructure:'Mga pasilidad', hydrants:'Mga hydrant', hospitals:'Mga ospital', fireStations:'Mga istasyon ng bumbero',
        expandPanel:'Buksan ang panel', collapsePanel:'Isara ang panel', retry:'Subukan muli',
        assessing:(completed,total) => `Sinusuri ang mga panganib · ${completed}/${total}`,
        awaiting:(completed,unavailable) => `${completed} ulat ang handa · ${unavailable} ang naghihintay ng pagsusuri`,
        ready:n => `${n} pagsusuri ang handa`, progressError:'Hindi matingnan ang pag-usad ng pagsusuri'
    },
    drawer: {
        verification: { verified: 'Naberipika', unverified: 'Hindi pa beripikado' },
        ...EN_STRINGS.drawer,
        closeBtn:'Isara', barangayLabel:'Barangay', addressLabel:'Tirahan', categoryLabel:'Uri ng panganib', descLabel:'Paglalarawan',
        historyTitle:'Kasaysayan ng sunog sa lokasyong ito', noHistory:'Walang tala ng insidente para sa ulat na ito.', contactsTitle:'Mga contact sa emergency',
        tabBefore:'Bago', tabDuring:'Habang', tabAfter:'Pagkatapos', tabEvacuation:'Paglikas', tabProhibited:'Mga hindi dapat gawin',
        placeholderWarn:'Hindi pa nakatakda ang contact number', preSeeded:'Nakahandang pagsusuri', gemini:'Sinuri ng Gemini', guidance:'Gabay sa paghahanda', geminiGuidance:'Gabay mula sa Gemini',
        confidenceHigh:'Mataas na kumpiyansa', confidenceMed:'Katamtamang kumpiyansa', confidenceLow:'Mababang kumpiyansa',
        locationTitle:'Lokasyon at paglalarawan', classification:'Klasipikasyon', coordinates:'Mga coordinate', photoUnavailable:'Wala pang larawan', photoHint:'Maaaring magdagdag ng larawan dito ang may-ari ng lugar.',
        preparedness:'Plano ng paghahanda ng komunidad', context:'Konteksto ng barangay', evacuationSite:'Itinalagang lugar ng paglikas',
        moreEvidence:'Kailangan pa ng ebidensiya', risk:'na panganib', confidence:'na kumpiyansa', reporterSelected:'Pinili ng nag-ulat',
        unavailable:'Hindi magamit ang pagsusuri', assessing:'Sinusuri ng Gemini ang panganib na ito', liveReported:'May iniulat na kasalukuyang sunog',
        liveHelp:'Gamitin ang mga contact sa ibaba upang tumawag para sa tulong.',
        retryHelp:'Na-save ang ulat. Subukan muli ang pagsusuri mula sa mga kontrol ng mapa. Wala pang nabuong score.',
        assessingHelp:'Lalabas dito ang pagsusuri at mga pag-iingat kapag handa na. Maaari mo munang tingnan ang mapa.',
        disclaimer:'Batayan ng pagbibigay-prayoridad · hindi posibilidad ng sunog.', rangeNote:'Ipinapakita ng saklaw ang kakulangan ng mga obserbasyon.',
        immediate:'Inirerekomenda ang agarang aksiyon.', unknown:'Hindi pa alam', noSteps:'Walang nakatalang tagubilin para sa bahaging ito.', call:'Tumawag', unconfigured:'Hindi pa nakatakda',
        loading:'Kinukuha ang ulat…', preparing:'Inihahanda ang mga detalye ng ulat', loadFailed:'Hindi makuha ang ulat'
    },
    categories: { faulty_wiring:'Sirang wiring', lpg_storage:'Imbakan ng LPG / gas', dry_grass:'Tuyong damo', overloaded_outlets:'Sobrang karga sa mga outlet', blocked_exit:'Nakaharang na labasan', illegal_burning:'Hindi ligtas na pagsusunog', informal_settlement:'Magkakadikit na mga gusali', flammable_storage:'Imbakan ng madaling masunog', other:'Iba pa' },
    statuses: { potential:'Posibleng panganib', active:'Kasalukuyang sunog', contained:'Nakontrol', resolved:'Nalutas' },
    errors: { ...EN_STRINGS.errors, networkError:'Hindi makakonekta sa server. Suriin ang iyong koneksiyon.', serverError:'May problema sa server. Subukan muli.', loadFailed:'Hindi makuha ang datos ng panganib.' },
    factors: {
        ...EN_STRINGS.factors, title:'Batayan ng score', cards:'Mga salik ng panganib', factor:'Salik', next:'Susunod na salik', previous:'Nakaraang salik', show:'Ipakita', unknown:'Hindi alam', more:'Kailangan pa ng obserbasyon', contribution:'Ambag sa kabuuang panganib', outOf:n => `mula sa ${n}`, unscored:'Walang score · kulang ang ebidensiya',
        points:(score,max) => `${score} / ${max} puntos · ${Math.round(score/max*100)}% ng pinakamataas para sa salik na ito`,
        labels:{ ignition_sources:'Pinagmumulan ng apoy', fuel_combustibles:'Mga madaling masunog', proximity_to_people:'Mga taong maaaring maapektuhan', structure_material:'Pagkalat ng apoy', escape_routes:'Mga daan palabas', truck_access:'Daan para sa mga responder', fire_history:'Kasaysayan ng sunog', weather_seasonal:'Kapaligiran', human_behavior:'Hindi ligtas na gawain', safeguards:'Mga hakbang sa kaligtasan' }
    },
    welcome: { eyebrow:'Nagsisimula sa atin ang mas ligtas na komunidad', heading:'Maligayang pagdating sa', accent:'EmbeReady.', intro:'Ako si Ember, ang iyong kasama sa kaligtasan sa sunog. Tingnan ang mga kalapit na panganib, unawain ang mga risk, at tulungang manatiling may kaalaman ang Batangas City.', features:['Mga ulat ng komunidad','Pagsusuri ng Gemini','Hindi kailangan ng account'], search:'Pumunta sa barangay o palatandaan', greeting:'Kumusta! Ako si Ember.', explore:'Pumunta sa mapa ng panganib sa sunog', note:'Tuklasin. Mag-ulat. Maghanda.', madeFor:'Para sa Batangas City', footer:'Kaalaman sa komunidad. Sama-samang paghahanda.' },
    help: { faq:'FAQ', title:'Mga madalas itanong', close:'Isara ang FAQ', language:'Wika' }
};

TL_STRINGS.welcome.pauseMotion = 'Ihinto ang mga galaw';
TL_STRINGS.welcome.resumeMotion = 'Ituloy ang mga galaw';
TL_STRINGS.drawer.scrollPlanLeft = 'Ipakita ang mga naunang tab sa paghahanda';
TL_STRINGS.drawer.scrollPlanRight = 'Ipakita ang iba pang tab sa paghahanda';

TL_STRINGS.ember = { greeting:'Kumusta, ako si Ember.', idle:'Pindutin ang isang pin sa mapa upang makita ang ulat at gabay sa kaligtasan.', saved:'Na-save ang iyong ulat. Direktang kontakin ang mga responder kung kailangan.', thinking:'Sinusuri ang iyong ulat.', hello:'Kumusta! Tutulungan kitang tuklasin ang mapa.', walking:'Handa ka na? Pumili ng barangay o pindutin ang isang pin.', paused:'Naka-off ang galaw · ayon sa system', resume:'Ipagpatuloy ang galaw ng mascot', pause:'Ihinto ang galaw ng mascot', wave:'Kumaway kay Ember' };

EN_STRINGS.flow = {
    eyebrow:'Help your community', question:'What are you reporting?', intro:'Choose the risk level first. Then tell us what you noticed.',
    riskQuestion:'What risk level are you reporting?', chooseRisk:'Choose a risk level…',
    liveTitle:'Report a live fire', hazardTitle:'Report a fire hazard',
    liveIntro:'Pin the fire, then open responder contacts.', hazardIntro:'Choose the risk level first. Gemini will independently assess the evidence.',
    levels:{live_fire:'Live fire / emergency now',heavy:'High risk',moderate:'Moderate risk',low:'Low risk'},
    levelHints:{live_fire:'Pin the fire, then open Alert.',heavy:'A serious hazard needing prompt attention.',moderate:'An unsafe condition that could worsen.',low:'A potential concern to inspect and prevent.'},
    liveNoteTitle:'Location first. Contact help next.', liveNote:'You won’t be asked for a description or photos. Alert opens numbers to copy and call manually.',
    notice:'What did you notice?', details:'Hazard details', category:'Hazard category', chooseCategory:'Choose a category…', title:'Hazard title',
    address:'Street or nearby landmark', description:'What can you see?', optional:'optional', photo:'Add a photo', photoOptional:'optional · hazards only',
    photoPrompt:'Drop a photo or click to browse', photoHint:'JPG, PNG or WebP · up to 5 MB', observations:'More site observations', observationsHint:'Only add what you already know. Leave unknown conditions blank.',
    structure:'Building materials and spacing', people:'People nearby', exits:'Escape routes', access:'Road and responder access', safeguards:'Existing safety measures',
    where:'Where is it?', pin:'Pin a location', pinHint:'Tap the exact location on the map. Drag the pin to adjust it.', noPin:'No location pinned yet', pinned:'Location pinned', outside:'Outside Batangas City', correction:'optional correction', nearestOption:'Use nearest barangay to pin',
    selectedBarangay:name=>`Selected barangay: ${name}`, nearestBarangay:name=>`Nearest barangay: ${name}. This is a proximity suggestion, not a boundary check.`,
    submit:'Submit hazard report', alert:'Alert · view responder contacts', submitNote:'Your selected risk is saved. Gemini assesses the observations independently.', liveSubmitNote:'Saves your pinned location and opens contacts to copy and call manually.',
    errors:'Please check your report', chooseLevelError:'Choose the reported risk level first.', categoryError:'Choose a fire hazard category.', pinError:'Pin a location within Batangas City.', titleError:'Give the hazard a title between 5 and 180 characters.', photoSizeError:'Keep the photo under 5 MB.', photoTypeError:'Choose a JPG, PNG or WebP photo.', saveError:'The report could not be saved. Please retry.',
    savingLocation:'Saving location…', savingReport:'Saving report…', saved:'Report saved', responders:'Contact responders', savingPin:'Saving your pinned location…', notSaved:'Location not saved',
    contactsIntro:'Copy a number and call manually. Opening this panel does not send an alert or place a call.', back:'Back to the map',
    liveSaving:'Your contacts are ready. Copy a number below to call manually.', liveSaved:'Live fire location saved. Use the contacts below to call manually.',
    assessing:'Report saved. Gemini is assessing your observations in the background. Your selected risk is shown until assessment completes.', unavailable:'Report saved. Gemini is unavailable; your selected risk remains labelled as reporter-selected.',
    contactSaveError:'The report could not be saved. Contacts remain available to copy and call manually.',
    sampleContact:'Sample contact', sampleNote:'Sample number for demonstration. Replace with a verified number before real use.', nearestPin:'nearest to pin', copy:'Copy', copied:'Copied', sampleCopied:'Sample number copied. This is not an operational emergency contact.', copiedNote:'Number copied. Call manually to contact responders.', selectCopy:'The number is selected. Use Copy on your device.'
};
TL_STRINGS.flow = {
    eyebrow:'Tumulong sa iyong komunidad', question:'Ano ang iyong iuulat?', intro:'Piliin muna ang antas ng panganib. Pagkatapos, ilahad ang iyong napansin.',
    riskQuestion:'Anong antas ng panganib ang iyong iuulat?', chooseRisk:'Pumili ng antas ng panganib…',
    liveTitle:'Mag-ulat ng kasalukuyang sunog', hazardTitle:'Mag-ulat ng panganib sa sunog', liveIntro:'I-pin ang sunog, pagkatapos ay buksan ang mga contact ng responder.', hazardIntro:'Piliin muna ang antas ng panganib. Hiwalay na susuriin ng Gemini ang ebidensiya.',
    levels:{live_fire:'May sunog / emergency ngayon',heavy:'Mataas na panganib',moderate:'Katamtamang panganib',low:'Mababang panganib'},
    levelHints:{live_fire:'I-pin ang sunog, pagkatapos ay buksan ang Alert.',heavy:'Malubhang panganib na nangangailangan ng agarang pansin.',moderate:'Hindi ligtas na kondisyon na maaaring lumala.',low:'Posibleng panganib na dapat suriin at pigilan.'},
    liveNoteTitle:'Lokasyon muna. Kontakin ang tulong pagkatapos.', liveNote:'Hindi hihingi ng paglalarawan o larawan. Binubuksan ng Alert ang mga numero upang ikaw ang kumopya at tumawag.',
    notice:'Ano ang iyong napansin?', details:'Mga detalye ng panganib', category:'Uri ng panganib', chooseCategory:'Pumili ng uri…', title:'Pamagat ng panganib', address:'Kalye o malapit na palatandaan', description:'Ano ang iyong nakikita?', optional:'opsiyonal', photo:'Magdagdag ng larawan', photoOptional:'opsiyonal · para sa panganib lamang',
    photoPrompt:'Mag-drop ng larawan o pindutin upang pumili', photoHint:'JPG, PNG o WebP · hanggang 5 MB', observations:'Iba pang obserbasyon sa lugar', observationsHint:'Ilagay lamang ang alam mo na. Iwang blangko ang hindi alam.',
    structure:'Materyales at pagitan ng mga gusali', people:'Mga tao sa paligid', exits:'Mga daan palabas', access:'Daan para sa mga responder', safeguards:'Mga kasalukuyang hakbang sa kaligtasan',
    where:'Nasaan ito?', pin:'I-pin ang lokasyon', pinHint:'Pindutin ang eksaktong lokasyon sa mapa. I-drag ang pin upang ayusin ito.', noPin:'Wala pang naka-pin na lokasyon', pinned:'Naka-pin na ang lokasyon', outside:'Nasa labas ng Batangas City', correction:'opsiyonal na pagwawasto', nearestOption:'Gamitin ang pinakamalapit na barangay sa pin',
    selectedBarangay:name=>`Piniling barangay: ${name}`, nearestBarangay:name=>`Pinakamalapit na barangay: ${name}. Mungkahi ito batay sa lapit, hindi pagsusuri ng hangganan.`,
    submit:'Isumite ang ulat ng panganib', alert:'Alert · tingnan ang mga contact', submitNote:'Na-save ang pinili mong antas. Hiwalay na sinusuri ng Gemini ang mga obserbasyon.', liveSubmitNote:'Sine-save ang naka-pin na lokasyon at binubuksan ang mga contact upang ikaw ang kumopya at tumawag.',
    errors:'Pakisuri ang iyong ulat', chooseLevelError:'Piliin muna ang antas ng panganib.', categoryError:'Pumili ng uri ng panganib sa sunog.', pinError:'I-pin ang lokasyon sa loob ng Batangas City.', titleError:'Maglagay ng pamagat na may 5 hanggang 180 character.', photoSizeError:'Panatilihing mas mababa sa 5 MB ang larawan.', photoTypeError:'Pumili ng JPG, PNG o WebP na larawan.', saveError:'Hindi ma-save ang ulat. Subukan muli.',
    savingLocation:'Sine-save ang lokasyon…', savingReport:'Sine-save ang ulat…', saved:'Na-save ang ulat', responders:'Kontakin ang mga responder', savingPin:'Sine-save ang naka-pin mong lokasyon…', notSaved:'Hindi na-save ang lokasyon',
    contactsIntro:'Kumopya ng numero at ikaw ang tumawag. Ang pagbukas ng panel ay hindi nagpapadala ng alert o tumatawag.', back:'Bumalik sa mapa', liveSaving:'Handa na ang mga contact. Kumopya ng numero sa ibaba at ikaw ang tumawag.', liveSaved:'Na-save ang lokasyon ng sunog. Gamitin ang mga contact sa ibaba upang ikaw ang tumawag.',
    assessing:'Na-save ang ulat. Sinusuri ng Gemini ang mga obserbasyon. Ipinapakita muna ang pinili mong antas hanggang matapos ang pagsusuri.', unavailable:'Na-save ang ulat. Hindi magamit ang Gemini; may label pa rin ang pinili mong antas bilang pinili ng nag-ulat.', contactSaveError:'Hindi ma-save ang ulat. Maaari mo pa ring kopyahin ang mga contact at ikaw ang tumawag.',
    sampleContact:'Halimbawang contact', sampleNote:'Halimbawang numero para sa demo. Palitan ng beripikadong numero bago gamitin sa tunay na sitwasyon.', nearestPin:'pinakamalapit sa pin', copy:'Kopyahin', copied:'Nakopya', sampleCopied:'Nakopya ang halimbawang numero. Hindi ito gumaganang contact sa emergency.', copiedNote:'Nakopya ang numero. Ikaw ang tumawag upang makontak ang mga responder.', selectCopy:'Napili ang numero. Gamitin ang Copy sa iyong device.'
};

function getStrings(lang = 'en') {
    return ['tl', 'fil'].includes(lang) ? TL_STRINGS : EN_STRINGS;
}

let _currentLang = 'en';
try { _currentLang = ['tl','fil'].includes(localStorage.getItem('embeready-lang')) ? 'tl' : 'en'; } catch {}
export const S = { ...getStrings(_currentLang) };
export function getLanguage() { return _currentLang; }
export function setLanguage(lang) {
    _currentLang = ['tl','fil'].includes(lang) ? 'tl' : 'en';
    Object.assign(S, getStrings(_currentLang));
    try { localStorage.setItem('embeready-lang', _currentLang); } catch {}
    window.dispatchEvent(new CustomEvent('language:changed', { detail: { language: _currentLang } }));
}
export default S;
export { getStrings };
