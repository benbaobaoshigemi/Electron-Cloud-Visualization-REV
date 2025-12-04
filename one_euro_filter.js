/**
 * One Euro Filter implementation
 * Ref: http://cristal.univ-lille.fr/~casiez/1euro/
 */
class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dcutoff = dcutoff;
        this.x = null;
        this.dx = 0;
        this.lastTime = null;
    }

    alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    filter(value, timestamp) {
        // If first time, just return value
        if (this.lastTime === null) {
            this.lastTime = timestamp;
            this.x = value;
            this.dx = 0;
            return value;
        }

        // Calculate dt in seconds
        let dt = (timestamp - this.lastTime) / 1000;
        // Avoid division by zero or negative dt
        if (dt <= 0) dt = 0.001;

        this.lastTime = timestamp;

        // Filter the derivative (speed)
        const cutoff = this.dcutoff;
        const alpha_d = this.alpha(cutoff, dt);
        const dx_raw = (value - this.x) / dt;
        const dx = alpha_d * dx_raw + (1 - alpha_d) * this.dx;
        this.dx = dx;

        // Calculate cutoff for the signal based on speed
        const edx = Math.abs(dx);
        const cutoff_x = this.minCutoff + this.beta * edx;

        // Filter the signal
        const alpha_x = this.alpha(cutoff_x, dt);
        const x = alpha_x * value + (1 - alpha_x) * this.x;
        this.x = x;

        return x;
    }

    reset() {
        this.x = null;
        this.dx = 0;
        this.lastTime = null;
    }
}
