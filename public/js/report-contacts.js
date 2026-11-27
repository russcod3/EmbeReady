// Use saved demo numbers for mock contacts; prefer supplied operational hotlines.
export function responderContacts(contacts = [], barangayName = 'the pinned area') {
    const targets = [
        {type:'bfp',name:'BFP · Batangas City'},
        {type:'barangay',name:`Barangay desk · ${barangayName}`},
        {type:'municipality',name:'City / municipal response desk'}
    ];
    return targets.map(target => {
        const matching = contacts.filter(c => String(c.agency_type).toLowerCase() === target.type && (target.type !== 'barangay' || c.jurisdiction === barangayName));
        const contact = matching.find(c => !c.is_placeholder && /^\+?[\d ()-]{3,}$/.test(c.phone_dialable || ''))
            || matching.find(c => c.is_placeholder && /^\+?\d{7,15}$/.test(String(c.phone_display || '').replace(/[()\s-]/g, '')));
        return {
            agency:target.type,
            name:contact?.facility_name || matching[0]?.facility_name || target.name,
            number:contact ? contact.phone_display || contact.phone_dialable : '',
            mock:Boolean(contact?.is_placeholder),
            unavailable:!contact,
            jurisdiction:contact?.jurisdiction || (target.type === 'barangay' ? barangayName : 'Batangas City')
        };
    });
}
