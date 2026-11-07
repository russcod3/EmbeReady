# Ember shaded cutout rig

`embeready-mascot.png` remains the original reference, unchanged.

`ember-texture-atlas.png` is a transparent 1536 × 1024 image generated with the built-in imagegen tool from that reference. It contains six parts in a 3 × 2 grid: head, torso, tail, downward arm, raised arm, and hind leg. The head includes both flame tufts as one continuous piece. Both instances of the hind leg share the same texture.

Prompt specification: preserve Ember's original identity, soft 3D clay texture, orange coral skin, cream muzzle, glossy dark eyes, cheek spots, teal scarf and shield clasp; create six disconnected shaded body parts on transparent background; keep both flame tufts attached seamlessly to the head; paint hidden attachment surfaces for overlapping joints; retain consistent upper-left lighting; no vector redraw, text or grid lines.

`../js/ember-puppet.js` maps atlas rectangles into 2D SVG image layers. `../css/ember.css` rotates those layers at shoulder, hip, neck and tail pivots. This is a textured 2D cutout puppet, not a 3D mesh. The full arms move as cutouts; there are no separate finger or eye-deformation layers in this atlas. Walking is an in-place cycle.
