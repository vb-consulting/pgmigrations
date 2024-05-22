const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",
    
    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
        gray: "\x1b[90m",
        crimson: "\x1b[38m" // Scarlet
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m",
        gray: "\x1b[100m",
        crimson: "\x1b[48m"
    }
};

module.exports = {
    info: (message) => console.log(colors.fg.cyan, message, colors.reset),
    error: (message) => console.log(colors.bg.red, message, colors.reset),
    warning: (message) => console.log(colors.bg.yellow, message, colors.reset),
    sections: (items, len) => {
        for(let i = 0; i < items.length; i++) {
            var item = items[i];
            process.stdout.write(item.key + " ".repeat(len - item.key.length));
            console.log(colors.fg.cyan, item.value, colors.reset)
        }
    },

    passed: (msg) => {
        process.stdout.write(colors.fg.green + "Passed: " + colors.reset + msg);
        console.log(colors.reset);
    },
    failed: (msg) => {
        process.stdout.write(colors.fg.red + "Failed: " + colors.reset + msg);
        console.log(colors.reset);
    }
};
