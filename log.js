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
        brightBlue: "\x1b[94m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        brightCyan: "\x1b[96m",
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
        brightBlue: "\x1b[104m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m",
        gray: "\x1b[100m",
        crimson: "\x1b[48m",
        brightCyan: "\x1b[106m",
    }
};

module.exports = {
    info: (message) => console.log(colors.fg.cyan, message, colors.reset),

    logDataMsg: (message) => {
        var type;
        var lines = message.split("\n");

        for (let i = 0; i < lines.length; i++) {
            var line = lines[i].replace("psql:", "");
            var idx = line.indexOf("INFO:");
            if (idx !== -1) {
                idx += "INFO:".length;
                process.stdout.write(colors.underscore + colors.bg.cyan + line.substring(0, idx) + colors.reset);
                console.log(colors.fg.cyan, line.substring(idx), colors.reset);
                type = "I";
            } else {
                var idx = line.indexOf("NOTICE:");
                if (idx !== -1) {
                    idx += "NOTICE:".length;
                    process.stdout.write(colors.underscore + colors.bg.brightBlue + line.substring(0, idx) + colors.reset);
                    console.log(colors.fg.brightBlue, line.substring(idx), colors.reset);
                    type = "N";
                } else {
                    var idx = line.indexOf("WARNING:");
                    if (idx !== -1) {
                        idx += "WARNING:".length;
                        process.stdout.write(colors.underscore + colors.bg.yellow + line.substring(0, idx) + colors.reset);
                        console.log(colors.fg.yellow, line.substring(idx), colors.reset);
                        type = "W";
                    } else {
                        var idx = line.indexOf("ERROR:");
                        if (idx !== -1) {
                            idx += "ERROR:".length;
                            process.stdout.write(colors.underscore + colors.bg.red + line.substring(0, idx) + colors.reset);
                            console.log(colors.fg.red, line.substring(idx), colors.reset);
                            type = "E";
                        } else {
                            var idx = line.indexOf("STATEMENT:");
                            if (idx !== -1) {
                                console.log(colors.fg.gray, line, colors.reset); 
                                type = "S";
                            } else {
                                // neither
                                if (type == "I") {
                                    console.log(colors.fg.cyan, line, colors.reset);
                                } else if (type == "N") {
                                    console.log(colors.fg.brightBlue, line, colors.reset);
                                } else if (type == "W") {
                                    console.log(colors.fg.yellow, line, colors.reset);
                                } else if (type == "E") {
                                    console.log(colors.fg.red, line, colors.reset);
                                } else if (type == "S") {
                                    console.log(colors.fg.gray, line, colors.reset);
                                } else {
                                    console.log(colors.fg.cyan, line, colors.reset);
                                }
                            }
                        }
                    }
                }
            }
        }
    },
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
