// Macro library + saved-macro example data for the Create surface. Curated starter macros are real.
import type { MacroStarter, SavedMacro } from './types'

export const MACRO_LIBRARY: MacroStarter[] = [
  {
    id: 'preheat-pla', title: 'Preheat PLA', blurb: 'Warm the bed and nozzle to PLA temperatures, then tell you when it is ready.',
    category: 'Heating', icon: 'IconBolt', accent: 'amber', installs: 41200,
    body: `[gcode_macro PREHEAT_PLA]
description: Warm the bed and nozzle for PLA
gcode:
    {% set bed = params.BED|default(60)|int %}
    {% set nozzle = params.NOZZLE|default(215)|int %}
    M140 S{bed}        # start heating the bed, do not wait
    M104 S{nozzle}     # start heating the nozzle, do not wait
    M190 S{bed}        # now wait for the bed to reach target
    M109 S{nozzle}     # now wait for the nozzle to reach target
    RESPOND MSG="PLA ready"`,
    tunables: [
      { key: 'BED', label: 'Bed temperature', type: 'number', unit: 'C', default: 60, min: 0, max: 120, hint: '60 is a safe PLA default. Bump to 65 if your first layer lifts.' },
      { key: 'NOZZLE', label: 'Nozzle temperature', type: 'number', unit: 'C', default: 215, min: 150, max: 300, hint: 'Most PLA likes 200 to 220. Check the spool.' },
    ],
  },
  {
    id: 'park-toolhead', title: 'Park toolhead', blurb: 'Lift and move the toolhead to a safe corner, out of the way of the print.',
    category: 'Motion', icon: 'IconPrinter', accent: 'teal', installs: 28900,
    body: `[gcode_macro PARK]
description: Lift and park the toolhead at a safe corner
gcode:
    {% set z = params.Z_HOP|default(10)|int %}
    {% set px = params.X|default(10)|int %}
    {% set py = params.Y|default(10)|int %}
    G91                # switch to relative moves
    G1 Z{z} F600       # hop up so we clear the print
    G90                # back to absolute moves
    G1 X{px} Y{py} F6000`,
    tunables: [
      { key: 'Z_HOP', label: 'Lift height', type: 'number', unit: 'mm', default: 10, min: 0, max: 50, hint: 'How far up to hop before moving sideways.' },
      { key: 'X', label: 'Park X', type: 'number', unit: 'mm', default: 10, min: 0, max: 350, hint: 'Where to park, left to right.' },
      { key: 'Y', label: 'Park Y', type: 'number', unit: 'mm', default: 10, min: 0, max: 350, hint: 'Where to park, front to back.' },
    ],
  },
  {
    id: 'load-filament', title: 'Load filament', blurb: 'Heat up, then push filament through the nozzle until it flows clean.',
    category: 'Filament', icon: 'IconSpool', accent: 'rose', installs: 33100,
    body: `[gcode_macro LOAD_FILAMENT]
description: Heat and feed filament until it flows
gcode:
    {% set temp = params.TEMP|default(220)|int %}
    {% set amount = params.LENGTH|default(80)|int %}
    M109 S{temp}       # wait for the nozzle to be hot
    M83                # relative extrusion
    G1 E{amount} F300  # feed filament in slowly
    RESPOND MSG="Filament loaded"`,
    tunables: [
      { key: 'TEMP', label: 'Load temperature', type: 'number', unit: 'C', default: 220, min: 150, max: 300, hint: 'Hot enough to melt the filament you are loading.' },
      { key: 'LENGTH', label: 'Feed length', type: 'number', unit: 'mm', default: 80, min: 10, max: 200, hint: 'How much to push through. Enough to reach and clear the nozzle.' },
    ],
  },
  {
    id: 'purge-line', title: 'Purge line', blurb: 'Draw a priming line down the edge of the bed so the first layer starts clean.',
    category: 'Calibration', icon: 'IconChip', accent: 'violet', installs: 19400,
    body: `[gcode_macro PURGE_LINE]
description: Draw a priming line at the bed edge
gcode:
    G92 E0             # zero the extruder counter
    G1 X5 Y20 Z0.3 F3000
    G1 X5 Y200 E15 F1200   # draw the line while extruding
    G92 E0             # zero again, ready to print`,
    tunables: [],
  },
  {
    id: 'beep', title: 'Done chime', blurb: 'Play a short beep on the printer buzzer when a print finishes.',
    category: 'Notify', icon: 'IconBolt', accent: 'amber', installs: 8700,
    body: `[gcode_macro DONE_CHIME]
description: Beep when the print is finished
gcode:
    {% set count = params.BEEPS|default(3)|int %}
    {% for i in range(count) %}
    M300 S2000 P200    # tone at 2kHz for 200ms
    G4 P150            # short pause between beeps
    {% endfor %}`,
    tunables: [
      { key: 'BEEPS', label: 'Number of beeps', type: 'number', unit: '', default: 3, min: 1, max: 10, hint: 'How many times to chime.' },
    ],
  },
  {
    id: 'nudge-z', title: 'Z offset nudge', blurb: 'Shift the nozzle a hair closer or further from the bed while printing.',
    category: 'Calibration', icon: 'IconChip', accent: 'violet', installs: 12600,
    body: `[gcode_macro NUDGE_Z]
description: Live-adjust Z offset by a small step
gcode:
    {% set step = params.STEP|default(0.01)|float %}
    {% set dir = params.DIR|default("down") %}
    {% if dir == "down" %}
    SET_GCODE_OFFSET Z_ADJUST=-{step} MOVE=1
    {% else %}
    SET_GCODE_OFFSET Z_ADJUST={step} MOVE=1
    {% endif %}`,
    tunables: [
      { key: 'STEP', label: 'Step size', type: 'number', unit: 'mm', default: 0.01, min: 0.005, max: 0.1, hint: 'How much to move per nudge. 0.01 is fine and slow.' },
      { key: 'DIR', label: 'Direction', type: 'select', default: 'down', options: ['down', 'up'], hint: 'Down brings the nozzle closer to the bed.' },
    ],
  },
]

export const SAVED_MACROS: SavedMacro[] = [
  { id: 'my-preheat-petg', title: 'Preheat PETG', blurb: 'My PETG warmup, hotter bed than the stock one.', fromLibrary: 'preheat-pla', installedOn: ['u1-garage', 'u1-studio'], updatedAt: '4 days ago' },
  { id: 'my-goodnight', title: 'Goodnight', blurb: 'Park, turn everything off, and chime once.', fromLibrary: null, installedOn: ['u1-garage'], updatedAt: '2 weeks ago' },
]
