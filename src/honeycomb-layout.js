const INNER_SLOTS = [0, 1, 2, 3, 4, 5];
const OUTER_SLOTS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const HEXAGON_HEIGHT_RATIO = 2 / Math.sqrt(3);
const HEXAGON_ROW_STEP = Math.sqrt(3) / 2;

const INNER_POSITIONS = [
    { x: 0, y: HEXAGON_ROW_STEP },
    { x: 0.5, y: 0 },
    { x: 1.5, y: 0 },
    { x: 2, y: HEXAGON_ROW_STEP },
    { x: 1.5, y: HEXAGON_ROW_STEP * 2 },
    { x: 0.5, y: HEXAGON_ROW_STEP * 2 }
];

const OUTER_POSITIONS = [
    { x: -1, y: HEXAGON_ROW_STEP },
    { x: -0.5, y: 0 },
    { x: 0, y: -HEXAGON_ROW_STEP },
    { x: 1, y: -HEXAGON_ROW_STEP },
    { x: 2, y: -HEXAGON_ROW_STEP },
    { x: 2.5, y: 0 },
    { x: 3, y: HEXAGON_ROW_STEP },
    { x: 2.5, y: HEXAGON_ROW_STEP * 2 },
    { x: 2, y: HEXAGON_ROW_STEP * 3 },
    { x: 1, y: HEXAGON_ROW_STEP * 3 },
    { x: 0, y: HEXAGON_ROW_STEP * 3 },
    { x: -0.5, y: HEXAGON_ROW_STEP * 2 }
];

function validInteger(value, min, max)
{
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max
        ? number
        : null;
}

function assignButtons(entries, emptySlots = 'visible')
{
    const assigned = new Array(18);
    const hard = [];
    const soft = [];
    const automatic = [];
    const warnings = [];
    const limitedEntries = entries.slice(0, 18);

    if( entries.length > 18 )
        warnings.push(`Honeycomb supports at most 18 buttons; ignored ${entries.length - 18} extra button(s).`);

    limitedEntries.forEach(entry => {
        const button = entry.button;

        if( button && button.position !== undefined )
        {
            const target = validInteger(button.position, 0, 17);

            if( target !== null )
                hard.push({ ...entry, target });
            else
            {
                warnings.push(`Ignored invalid legacy position: ${button.position}.`);
                automatic.push(entry);
            }

            return;
        }

        if( button && button.slot !== undefined )
        {
            const requestedSlot = validInteger(button.slot, 1, 18);

            if( requestedSlot === null )
            {
                warnings.push(`Ignored invalid slot: ${button.slot}.`);
                automatic.push(entry);
            }
            else if( button.slot_mode === 'hard' )
                hard.push({ ...entry, target: requestedSlot - 1 });
            else
                soft.push({ ...entry, requestedSlot });

            return;
        }

        automatic.push(entry);
    });

    const rings = {
        inner: true,
        outer: limitedEntries.length > 6 || hard.some(entry => entry.target >= 6)
    };
    const activePool = rings.outer
        ? [...INNER_SLOTS, ...OUTER_SLOTS]
        : [...INNER_SLOTS];

    hard.forEach(entry => {
        if( assigned[entry.target] === undefined )
            assigned[entry.target] = entry.button;
        else
            warnings.push(`Hard slot ${entry.target + 1} is already occupied; ignored the duplicate.`);
    });

    soft.forEach(entry => {
        const requestedIndex = entry.requestedSlot - 1;
        const preferredTarget = rings.outer
            ? requestedIndex
            : requestedIndex % INNER_SLOTS.length;
        const preferredPoolIndex = Math.max(0, activePool.indexOf(preferredTarget));
        let target;

        for( let offset = 0; offset < activePool.length; offset++ )
        {
            const candidate = activePool[(preferredPoolIndex + offset) % activePool.length];

            if( assigned[candidate] === undefined )
            {
                target = candidate;
                break;
            }
        }

        if( target !== undefined )
            assigned[target] = entry.button;
        else
            warnings.push(`No free slot is available for requested soft slot ${entry.requestedSlot}.`);
    });

    automatic.forEach(entry => {
        const target = activePool.find(index => assigned[index] === undefined);

        if( target !== undefined )
            assigned[target] = entry.button;
        else
            warnings.push('No free slot is available for an automatic button.');
    });

    const slotCount = rings.outer ? 18 : 6;
    const buttons = Array.from({ length: slotCount }, (_, index) => {
        if( assigned[index] !== undefined )
            return assigned[index];

        return emptySlots === 'hidden' ? undefined : {};
    });

    return { buttons, rings, warnings };
}

function buttonPosition(slot, rings)
{
    let position;

    if( slot < 6 )
    {
        if( ! rings.inner )
            return null;
        position = INNER_POSITIONS[slot];
    }
    else
    {
        if( ! rings.outer )
            return null;
        position = OUTER_POSITIONS[slot - 6];
    }

    if( ! position )
        return null;

    return rings.outer
        ? { x: position.x + 1, y: position.y + HEXAGON_ROW_STEP }
        : { ...position };
}

function centerPosition(rings)
{
    return rings.outer
        ? { x: 2, y: HEXAGON_ROW_STEP * 2 }
        : { x: 1, y: HEXAGON_ROW_STEP };
}

function containerMetrics(size, rings)
{
    const item = size / 3.586;

    return {
        item,
        containerWidth: item * (rings.outer ? 5 : 3),
        containerHeight: item * (
            HEXAGON_HEIGHT_RATIO + HEXAGON_ROW_STEP * (rings.outer ? 4 : 2)
        )
    };
}

function animationStep(slot, mode = 'legacy')
{
    if( mode === 'sequential' )
        return slot + 1;

    if( mode === 'paired' )
        return slot < 6 ? (slot % 3) + 1 : ((slot - 6) % 6) + 1;

    return slot;
}

function isPastDragDeadzone(startX, startY, currentX, currentY, deadzone)
{
    if( ! [startX, startY, currentX, currentY].every(Number.isFinite) )
        return false;

    const safeDeadzone = Math.max(0, Number(deadzone) || 0);
    return Math.hypot(currentX - startX, currentY - startY) >= safeDeadzone;
}

module.exports = {
    HEXAGON_HEIGHT_RATIO,
    HEXAGON_ROW_STEP,
    INNER_SLOTS,
    OUTER_SLOTS,
    assignButtons,
    animationStep,
    buttonPosition,
    centerPosition,
    containerMetrics,
    isPastDragDeadzone
};
