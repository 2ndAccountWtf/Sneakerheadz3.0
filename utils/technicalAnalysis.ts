export function calculateRSI(data: { close: number }[], period: number = 14): number[] {
    const rsi: number[] = [];
    if (data.length < period) return [];

    let gains = 0;
    let losses = 0;

    // Initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff > 0) {
            gains += diff;
        } else {
            losses -= diff;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = 0; i < period; i++) {
        rsi.push(NaN); // RSI is not defined for the initial period
    }
    
    rsi[period-1] = 100 - (100 / (1 + (avgGain / avgLoss)));

    for (let i = period; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        let currentGain = 0;
        let currentLoss = 0;

        if (diff > 0) {
            currentGain = diff;
        } else {
            currentLoss = -diff;
        }

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

        if (avgLoss === 0) {
            rsi.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
    }

    return rsi;
}
