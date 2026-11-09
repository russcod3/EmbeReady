// Deliberately non-operational sample numbers for the prototype contact panel.
export function responderContacts(contacts = [], barangayName = 'the pinned area') {
    const targets = [
        {type:'bfp',name:'BFP · Batangas City',sample:'043 000 0000'},
        {type:'barangay',name:`Barangay desk · ${barangayName}`,sample:'043 000 0100'},
        {type:'municipality',name:'City / municipal response desk',sample:'043 000 0200'}
    ];
    return targets.map(target => {
        const contact = contacts.find(c => String(c.agency_type).toLowerCase() === target.type && (target.type !== 'barangay' || c.jurisdiction === barangayName) && !c.is_placeholder && /^\+?[\d ()-]{3,}$/.test(c.phone_dialable || ''));
        return contact
            ? {agency:target.type,name:contact.facility_name,number:contact.phone_display || contact.phone_dialable,mock:false,jurisdiction:contact.jurisdiction}
            : {agency:target.type,name:target.name,number:target.sample,mock:true,jurisdiction:target.type === 'barangay' ? barangayName : 'Batangas City'};
    });
}
