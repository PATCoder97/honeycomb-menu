// HA icons resolve SVG paths asynchronously. Do not animate a partially
// rendered card, or its glyph can appear/change while the whole cell scales.
function contentNodes(root)
{
    return Array.from(root.querySelectorAll('*')).flatMap(element => [
        element,
        ...(element.shadowRoot ? contentNodes(element.shadowRoot) : [])
    ]);
}

function contentReady(root)
{
    const nodes = contentNodes(root);
    if( nodes.some(element => element.isUpdatePending) )
        return false;

    return nodes.every(element => {
        if( element.localName === 'button-card' && !element.shadowRoot )
            return false;
        if( !['ha-icon', 'ha-state-icon'].includes(element.localName) ||
            (!element.icon && !element.stateObj) )
            return true;
        const children = element.shadowRoot ? contentNodes(element.shadowRoot) : [];
        return children.some(child =>
            (child.localName === 'path' && child.getAttribute('d')) ||
            (child.localName === 'use' && (child.getAttribute('href') || child.getAttribute('xlink:href'))) ||
            (child.localName === 'img' && child.complete && child.naturalWidth > 0)
        );
    });
}

async function waitForContent(root, signal, timeout = 1500)
{
    const started = Date.now();
    let stable = 0;
    while( !signal.aborted )
    {
        stable = contentReady(root) ? stable + 1 : 0;
        if( stable >= 2 || Date.now() - started >= timeout )
            return true;
        await new Promise(resolve => setTimeout(resolve, 16));
    }
    return false;
}

module.exports = { contentReady, waitForContent };
