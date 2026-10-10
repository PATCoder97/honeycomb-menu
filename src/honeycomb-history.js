class HoneycombHistory
{
    constructor(clone = value => value)
    {
        this._clone = clone;
        this.clear();
    }

    open(config, { nested = false, reset = false } = {})
    {
        if( reset )
            this.clear();

        if( nested && this.currentConfig )
            this.stack.push(this._clone(this.currentConfig));

        this.currentConfig = this._clone(config);
        return this.currentConfig;
    }

    back()
    {
        if( this.stack.length === 0 )
            return null;

        this.currentConfig = this.stack.pop();
        return this._clone(this.currentConfig);
    }

    clear()
    {
        this.stack = [];
        this.currentConfig = null;
    }
}

function normalizeIdleTimeout(value)
{
    const timeout = Number(value);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : 0;
}

module.exports = {
    HoneycombHistory,
    normalizeIdleTimeout
};
