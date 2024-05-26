const fs = require("fs");
const cp = require("child_process");
const {info, error, warning} = require("./log.js");

const message = (msg, err) => {
    msg.split("\n").forEach(line => {
        if (err) {
            error(line);
        } else {
            var lower = line.toLowerCase();
            if (lower.indexOf("error:") > -1 || lower.indexOf("fatal:") > -1 || lower.indexOf("panic:") > -1) {
                error(line);
            } else if (lower.indexOf("warning:") > -1) {
                warning(line);
            } else {
                info(line);
            }
        }
    });
};

function run(options) {
    var args = [];

    if (!options.command) {
        error("Command is required.");
        return;
    }
    if (!options.config[options.command]) {
        error(`Config key ${options.command} is required. Please provide a valid config key.`);
        return;
    }

    var cmd = options.config[options.command];

    if (options.config.host) {
        args.push(`--host=${options.config.host}`);
    }
    if (options.config.port) {
        args.push(`--port=${options.config.port}`);
    }
    if (options.config.dbname) {
        args.push(`--dbname=${options.config.dbname}`);
    }
    if (options.config.username) {
        args.push(`--username=${options.config.username}`);
    }

    if (options.returnBuffer) {
        args.push("--tuples-only", "--no-align");
    }

    if (options.dump) {
        args.push("--schema-only");
        args.push("--encoding=UTF8");
        if (options.config.schemaDumpAdditionalArgs && options.config.schemaDumpAdditionalArgs.length) {
            args.push(...options.config.schemaDumpAdditionalArgs);
        }
    }

    if (options.sql || options.file) {
        args.push("--echo-errors");
        if (options.file) {
            args.push("--file");
            args.push(options.file);
        } else {
            args.push("--command");
            args.push(options.sql);
        }
    }

    if (options.additionalArgs && options.additionalArgs.length) {
        if (options.additionalArgs.indexOf("--help") > -1) {
            args = ["--help"];
        } else {
            args.push(...options.additionalArgs);
        }
    }

    if (options.verbose) {
        //const formattedArgs = args.map(a => a.replace(/\s+/g, ' ').trim()).map(a => a.indexOf(" ") > - 1 ? '"' + a + '"' : a).join(" ").trim();
        //console.info(`${cmd} ${formattedArgs}`);
        console.info(`${cmd} ${args.join(" ")}`);
    }

    var prefix = cmd + ":";

    return new Promise((resolve, reject) => {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        var spawnOptions = {};
        if (options.inherit) {
            spawnOptions.stdio = 'inherit';
        }
        if (options.config.password) {
            spawnOptions.env = {PGPASSWORD: options.config.password};
        }

        const child = cp.spawn(cmd, args, spawnOptions);
        if (!options.inherit) {
            child.stdout.on("data", data => {
                if (options.returnBuffer) {
                    stdoutBuffer += data.toString().trim();
                }
                else if (data) {
                    stdoutBuffer += data;
                    let index = stdoutBuffer.indexOf(prefix);
                    while (index !== -1) {
                        const msg = stdoutBuffer.slice(0, index).trim();
                        if (msg && !options.muted) {
                            message(msg);
                        }
                        stdoutBuffer = stdoutBuffer.slice(index + prefix.length);
                        index = stdoutBuffer.indexOf(prefix);
                    }
                }
            });

            child.stderr.on("data", data => {
                if (data) {
                    stderrBuffer += data;
                    let index = stderrBuffer.indexOf(prefix);
                    while (index !== -1) {
                        const msg = stderrBuffer.slice(0, index).trim();
                        if (msg && !options.muted) {
                            message(msg, true);
                        }
                        stderrBuffer = stderrBuffer.slice(index + prefix.length);
                        index = stderrBuffer.indexOf(prefix);
                    }
                }
            });
            child.on("exit", code => {
                if (options.returnBuffer) {
                    if (code === 0) {
                        resolve(stdoutBuffer.trim());
                    } else {
                        reject(stderrBuffer.trim());
                    }
                    
                } else if (!options.muted) {
                    if (stdoutBuffer) {
                        const msg = stdoutBuffer.trim();
                        if (msg) {
                            message(msg);
                        }
                    }
                    if (stderrBuffer) {
                        const msg = stderrBuffer.trim();
                        if (msg) {
                            message(msg, true);
                        }
                    }
                    resolve(code);
                } else {
                    resolve({
                        stdout: stdoutBuffer.trim(),
                        stderr: stderrBuffer.trim(),
                        code
                    });
                }
            });
        }
    });
}

function command(command, opt, additionalArgs, config, isCommand = false, muted = false) {
    var fileExists = false;
    if (!isCommand) {
        fileExists = (fs.existsSync(command) && fs.lstatSync(command).isFile());
    }
    return run({
        command: config.psql,
        config: config,
        sql: fileExists ? undefined : command,
        file: fileExists ? command : undefined,
        dump: false,
        additionalArgs: additionalArgs,
        verbose: opt.verbose,
        inherit: false,
        returnBuffer: false,
        muted: muted
    })
}

function schema(opt, additionalArgs, config) {
    return run({
        command: "pgdump",
        config: config,
        sql: false,
        file: false,
        dump: true,
        additionalArgs: additionalArgs,
        verbose: opt.verbose,
        inherit: false,
        returnBuffer: false
    })
}

function query(sql, opt, config) {
    return run({
        command: "psql",
        config: config,
        sql: sql,
        file: false,
        dump: false,
        additionalArgs: [],
        verbose: opt.verbose,
        inherit: false,
        returnBuffer: true
    })
}

function psql(opt, additionalArgs, config) {
    return run({
        command: "psql",
        config: config,
        sql: false,
        file: false,
        dump: false,
        additionalArgs: additionalArgs,
        verbose: opt.verbose,
        inherit: true,
        returnBuffer: false
    })
}

module.exports = {command, schema, query, psql, run}
