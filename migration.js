const path = require("path");
const { error, warning, info } = require("./log.js");
const { query, command, run } = require("./runner.js");
const fs = require("fs");

const types = {
    repetable: "R",
    up: "U",
    down: "D",
    repetableBefore: "P",
    before: "B",
    after: "A",
};

const names = {
    "R": "REPEATABLE",
    "U": "VERSION UP",
    "D": "VERSION DOWN",
    "P": "REPEATABLE BEFORE VERSION UP",
    "B": "BEFORE MIGRATIONS",
    "A": "AFTER MIGRATIONS",
};

const createHistoryTableScript = `
do $$
begin
    if exists(select 1 from information_schema.schemata where schema_name = '{schema}') is false then
        raise info 'create schema %;', '{schema}';
        create schema {schema};
    end if;

    if exists(select 1 from information_schema.tables where table_schema = '{schema}' and table_name = '{name}') is false then
        raise info 'create table %.%;', '{schema}', '{name}';
        create table {schema}.{name}
        (
            rank int,
            name text not null,
            type char not null check (type in ({types})),
            version text,
            script text not null,
            hash text not null,
            installed_by text not null,
            installed_on timestamp with time zone not null default now(),
            execution_time interval not null,
            primary key (name, type)
        );
    end if;
end;
$$;`;

const upsertHistorySql = `
insert into {historySchema}.{historyName} (name, type, version, script, hash, installed_by, execution_time)
values ('{name}', '{type}', {version}, '{script}', '{hash}', current_user, (clock_timestamp() - ___clock))
on conflict (name, type) do update set 
    version = {version}, 
    script = '{script}',
    hash = '{hash}',
    installed_by = current_user,
    installed_on = now(),
    execution_time = (clock_timestamp() - ___clock);
`;

const tableExistsQuery = `select exists(select 1 from information_schema.tables where table_schema = '{schema}' and table_name = '{name}')`;
const historyQuery = `select coalesce(json_agg(to_json(h)), '[]'::json) from {schema}.{name} h`;

function formatByName(str, obj) {
    return str.replace(/{([^{}]+)}/g, function(match, key) {
        return obj[key] !== undefined ? obj[key] : match;
    });
};

module.exports = async function(cmd, opt, config) {
    var mandatory = [
        "upPrefix","downPrefix","repetablePrefix","repetableBeforePrefix",
        "beforePrefix","afterPrefix","separatorPrefix",
        "historyTableName","historyTableSchema",
        "tmpDir","hashFunction"
    ];
    for (let i = 0; i < mandatory.length; i++) {
        const key = mandatory[i];
        if (!config[key]) {
            error(`Config key ${key} is required. Please provide a valid config key.`);
            return;
        }
    }
    if (Array.isArray(config.migrationDir)) {
        for (let i = 0; i < config.migrationDir.length; i++) {
            const migrationDir = config.migrationDir[i];
            if (!fs.existsSync(migrationDir)) {
                error(`Migration directory ${migrationDir} does not exist. Please provide a valid migration directory.`);
                return;
            }
            if (opt.verbose) {
                console.log("Using migration directory: " + migrationDir);
            }
        }
    }
    else {
        var migrationDir = path.join(process.cwd(), config.migrationDir);
        if (!fs.existsSync(migrationDir)) {
            error(`Migration directory ${migrationDir} does not exist. Please provide a valid migration directory.`);
            return;
        }
        if (opt.verbose) {
            console.log("Using migration directory: " + migrationDir);
        }
    }

    var schemaQuery = str => formatByName(str, {schema: config.historyTableSchema, name: config.historyTableName});

    try
    {
        if (!fs.existsSync(config.tmpDir)) {
            if (opt.verbose) {
                console.log("Creating tmp directory: " + config.tmpDir);
            }
            fs.mkdirSync(config.tmpDir);
        } else if (!config.keepMigrationDirHistory) {
            if (opt.verbose) {
                console.log("Clearing tmp directory: " + config.tmpDir);
            }
            fs.readdirSync(config.tmpDir).forEach(file => {
                fs.unlinkSync(path.join(config.tmpDir, file));
            });
        }

        var history = [];
        if (!opt.full) {
            var exists = (await query(schemaQuery(tableExistsQuery), opt, config)) == 't';
            if (exists) {
                history = JSON.parse(await query(schemaQuery(historyQuery), opt, config));

            } else {
                if (opt.verbose) {
                    console.log("Creating history table...");
                }
                var result = await command(formatByName(createHistoryTableScript, {
                    schema: config.historyTableSchema, 
                    name: config.historyTableName, 
                    types: Object.values(types).map(t => `'${t}'`).join(",")
                }), opt, [], config, true);
                
                if (result != 0) {
                    error("Failed to create history table, exiting...");
                    return;
                }
            }
        }

        var repetableHashes = {};
        var versionDict = {};
        history.forEach(h => {
            if (h.type == types.repetable || h.type == types.repetableBefore) {
                repetableHashes[h.hash + ";" + h.name] = h;
            }
            if (h.type == types.up) {
                versionDict[h.version] = h;
            }
        });

        const hasMultipleDirs = Array.isArray(config.migrationDir) || config.upDirs.length || config.downDirs.length || config.repetableDirs.length || config.repetableBeforeDirs.length || config.beforeDirs.length || config.afterDirs.length;

        const migrationDirs = Array.isArray(config.migrationDir) ? config.migrationDir : [config.migrationDir];
        
        const upDirsHash = {};
        const downDirsHash = {};
        const repetableDirsHash = {};
        const repetableBeforeDirsHash = {};
        const beforeDirsHash = {};
        const afterDirsHash = {};

        if (config.upDirs && config.upDirs.length > 0) {
            migrationDirs.push(...config.upDirs);
            config.upDirs.forEach(d => upDirsHash[d] = true);
        }
        if (config.downDirs && config.downDirs.length > 0) {
            migrationDirs.push(...config.downDirs);
            config.downDirs.forEach(d => downDirsHash[d] = true);
        }
        if (config.repetableDirs && config.repetableDirs.length > 0) {
            migrationDirs.push(...config.repetableDirs);
            config.repetableDirs.forEach(d => repetableDirsHash[d] = true);
        }
        if (config.repetableBeforeDirs && config.repetableBeforeDirs.length > 0) {
            migrationDirs.push(...config.repetableBeforeDirs);
            config.repetableBeforeDirs.forEach(d => repetableBeforeDirsHash[d] = true);
        }
        if (config.beforeDirs && config.beforeDirs.length > 0) {
            migrationDirs.push(...config.beforeDirs);
            config.beforeDirs.forEach(d => beforeDirsHash[d] = true);
        }
        if (config.afterDirs && config.afterDirs.length > 0) {
            migrationDirs.push(...config.afterDirs);
            config.afterDirs.forEach(d => afterDirsHash[d] = true);
        }
        
        const beforeList = [];
        const repetableBeforeList = [];
        const repetableList = [];
        const upList = [];
        const downList = [];
        const afterList = [];

        const upVersions = {};
        const downVersions = {};

        const isUp = cmd == "up";
        const isDown = cmd == "down";

        const versionUpNames = {};
        const versionDownNames = {};

        for (let i = 0; i < migrationDirs.length; i++) {
            const migrationDir = migrationDirs[i];
            if (!migrationDir) {
                continue;
            }
            if (!fs.existsSync(migrationDir) || !fs.lstatSync(migrationDir).isDirectory()) {
                error(`Migration directory ${migrationDir} does not exist or is not a directory. Please provide a valid migration directory.`);
                return;
            }

            fs.readdirSync(migrationDir).forEach(fileName => {
                const filePath = path.join(migrationDir, fileName);
                if (fs.lstatSync(filePath).isDirectory()) {
                    return;
                }

                if (!fileName.toLocaleLowerCase().endsWith('.sql')) {
                    return;
                }

                if (fileName.indexOf(config.separatorPrefix) == -1 
                    && repetableDirsHash[migrationDir] == false 
                    && repetableBeforeDirsHash[migrationDir] == false
                    && beforeDirsHash[migrationDir] == false
                    && afterDirsHash[migrationDir] == false
                    && upDirsHash[migrationDir] == false
                    && downDirsHash[migrationDir] == false) {
                    warning(`Migration file ${fileName} does not contain separator prefix ${config.separatorPrefix}. Skipping...`);
                    return;
                }

                let parts = fileName.split(config.separatorPrefix);
                let prefix = parts[0];
                let suffix = parts.slice(1).join(config.separatorPrefix);

                let name = hasMultipleDirs ? 
                    (migrationDir.replace(/_/g, " ").replace(/\./g, " ") + " " + suffix.split(".").slice(0, -1).join(".").replace(/_/g, " ")).trim() :
                    suffix.split(".").slice(0, -1).join(".").replace(/_/g, " ");

                let version = null;
                let type = null;
                const meta = {};

                const content = fs.readFileSync(filePath).toString();
                const hash = config.hashFunction(content);
                const script = hasMultipleDirs ? migrationDir + "/" + fileName : fileName;

                let pushTo = null;

                if (prefix.startsWith(config.upPrefix) || upDirsHash[migrationDir]) {
                    if (isUp) {
                        version = prefix.slice(config.upPrefix.length).trim();
                        if (upVersions[version]) {
                            error(`Migration file ${script} contains duplicate version ${version} already present in ${upVersions[version]}. Exiting...`);
                            process.exit(1);
                        }
                        upVersions[version] = script;
                        type = types.up;

                        if (!version) {
                            warning(`Migration file ${migrationDir}/${fileName} does not contain version. Skipping...`);
                            return;
                        }

                        if (versionDict[version]) {
                            return;
                        }

                        var count = versionUpNames[name];
                        count = count ? count + 1 : 1;
                        if (count > 1) {
                            name = name + " (" + count + ")";
                        }
                        versionUpNames[name] = count;

                        pushTo = upList;
                    }

                } else if (prefix.startsWith(config.downPrefix) || downDirsHash[migrationDir]) {
                    if (isDown) {
                        version = prefix.slice(config.downPrefix.length).trim();
                        if (downVersions[version]) {
                            error(`Migration file ${script} contains duplicate version ${version} already present in ${downVersions[version]}. Exiting...`);
                            process.exit(1);
                        }
                        downVersions[version] = script;
                        type = types.down;

                        if (!version) {
                            warning(`Migration file ${migrationDir}/${fileName} does not contain version. Skipping...`);
                            return;
                        }

                        if (!versionDict[version]) {
                            return;
                        }

                        var count = versionDownNames[name];
                        count = count ? count + 1 : 1;
                        if (count > 1) {
                            name = name + " (" + count + ")";
                        }
                        versionDownNames[name] = count;

                        meta.up = versionDict[version];
                        pushTo = downList;
                    }

                } else if (prefix == config.repetablePrefix || repetableDirsHash[migrationDir]) {
                    if (isUp) {
                        type = types.repetable;

                        if (repetableHashes[hash + ";" + name]) {
                            return;
                        }
                        pushTo = repetableList;
                    }
                } else if (prefix == config.repetableBeforePrefix || repetableBeforeDirsHash[migrationDir]) {
                    if (isUp) {
                        type = types.repetableBefore;
                        if (repetableHashes[hash + ";" + name]) {
                            pushTo = null;
                        }
                        pushTo = repetableBeforeList;
                    }
                } else if (prefix == config.beforePrefix || beforeDirsHash[migrationDir]) {
                    if (isUp) {
                        type = types.before;
                        pushTo = beforeList;
                    }

                } else if (prefix == config.afterPrefix || afterDirsHash[migrationDir]) {
                    if (isUp) {
                        type = types.after;
                        pushTo = afterList;
                    }

                } else {
                    warning(`Migration file ${fileName} does not contain valid prefix. Skipping...`);
                    return;
                }

                if (pushTo) {
                    pushTo.push({ name, version, type, script, hash, content, meta });
                }
            });
        }

        afterList.sort((a, b) => config.sortFunction(a.name, b.name));
        beforeList.sort((a, b) => config.sortFunction(a.name, b.name));

        repetableList.sort((a, b) => config.sortFunction(a.name, b.name));
        repetableBeforeList.sort((a, b) => config.sortFunction(a.name, b.name));

        upList.sort((a, b) => config.versionSortFunction(a.version, b.version));
        downList.sort((a, b) => config.versionSortFunction(b.version, a.version));

        if (opt.list) {
            if (isUp) {
                beforeList.concat(repetableBeforeList).concat(upList).concat(repetableList).concat(afterList).forEach((m, index) => {
                    console.log({
                        rank: index+1,
                        name: m.name, 
                        version: m.version,
                        type: names[m.type],
                        script: m.script,
                        hash: m.hash
                    })
                });
                return;
            }
            if (isDown) {
                downList.forEach((m, index) => {
                    console.log({
                        rank: index+1,
                        name: m.name, 
                        version: m.version,
                        type: names[m.type],
                        script: m.script,
                        hash: m.hash
                    })
                });
            }
        }

        if (isUp) {
            if (beforeList.length == 0 && repetableBeforeList.length == 0 && upList.length == 0 && repetableList.length == 0 && afterList.length == 0) {
                warning("Nothing to migrate.");
                return;
            }
        } else if (isDown) {
            if (downList.length) {
                warning("Nothing to migrate.");
                return;
            }
        }

        const date = new Date();
        const ident = date.toISOString().replace(/[-:.ZT]/g, "");
        const tmpFile = path.join(config.tmpDir, `migration_${ident}.sql`);
        if (opt.verbose) {
            console.log("Creating migration file: " + tmpFile);
        }
        if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
        }
        const line = l => fs.appendFileSync(tmpFile, l + "\n", { encoding: "utf8", flag: "a" });

        let index = 0;
        const addMigration = list => list.forEach(m => {
            index++;
            const cleanUp = m.type == types.down ? 
                `delete from ${config.historyTableSchema}.${config.historyTableName} where name = '${m.meta.up.name}' and type = '${types.up}';` : 
                formatByName(upsertHistorySql, {  
                    historySchema: config.historyTableSchema, 
                    historyName: config.historyTableName,
                    name: m.name,
                    type: m.type,
                    version: m.version ? `'${m.version}'` : "null",
                    script: m.script,
                    hash: m.hash
                });

            line(`--
-- Migration ${index}
-- Script: ${m.script}
-- Type: ${names[m.type]}
--
raise info 'Running migration %: %. Script file: %', ${index}, '${m.name}', '${m.script}';
___clock = clock_timestamp();
-- Migration ${index} start
${m.content}
-- Migration ${index} end
${cleanUp}
`);
        });

        line(`--
-- Migration file generated by pgmigrations
-- Date: ${date.toISOString()}
--

do
$migration_${ident}$
declare ___clock timestamp with time zone;
begin

`);

        if (beforeList.length == 0 && 
            repetableBeforeList.length == 0 && 
            upList.length == 0 && downList.length == 0 && repetableList.length == 0 && afterList.length == 0) {
        }

        if (isUp) {
            addMigration(beforeList);
            addMigration(repetableBeforeList);
            addMigration(upList);
            addMigration(repetableList);
            addMigration(afterList);
        } else if (isDown) {
            addMigration(downList);
        }

        line(`-- Update ranks
${schemaQuery(`update {schema}.{name}
set rank = t.rank
from (
    select name, type, row_number() over (order by 
        case 
            when type = 'B' then 1
            when type = 'P' then 2
            when type = 'U' then 3
            when type = 'R' then 4
            when type = 'A' then 5
            else 6
        end,
        version,
        name) as rank
    from schema_history
    ) as t
where schema_history.name = t.name and schema_history.type = t.type;`)}
`);

        if (opt.dry) {
            line(`raise info 'Rolling back migration changes...';
rollback;`);
        }

        line(`end;
$migration_${ident}$;`);

    if (opt.dump) {
        info("\n" + fs.readFileSync(tmpFile, { encoding: "utf8"}));
    } else {
        console.log("Running migration...");
        var result = await run({
            command: config.psql,
            config: config,
            file: tmpFile,
            verbose: opt.verbose
        });
        if (result != 0) {
            error("Migration failed with exit code " + result + ". Changes have been rolled back.");
            return;
        } else {
            console.info("Migration completed successfully.");
            console.info("Migration file available: " + tmpFile);
        }
    }

    } catch (e) {
        error(e);
        warning("Migration aborted!");
    }
}

