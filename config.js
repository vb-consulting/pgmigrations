const crypto = require('crypto');
const os = require('os');
const path = require('path');

module.exports = {
    host: "",
    port: "",
    dbname: "",
    username: "",
    password: "",
    
    psql: "psql",
    pgdump: "pg_dump",
    schemaDumpAdditionalArgs: ["--no-owner", "--no-acl"],
    verbose: false,
    env: false,

    migrationDir: "",
    
    upDirs: [],
    downDirs: [],
    repetableDirs: [],
    repetableBeforeDirs: [],
    beforeDirs: [],
    afterDirs: [],

    upPrefix: "V",
    downPrefix: "U",
    repetablePrefix: "R",
    repetableBeforePrefix: "R_before",
    beforePrefix: "before",
    afterPrefix: "after",
    separatorPrefix: "__",
    migrationExtensions: [".sql"],
    recursiveDirs: false,
    keepMigrationDirHistory: false,
    tmpDir: path.join(os.tmpdir(), "___pgmigrations"),
    historyTableName: "schema_history",
    historyTableSchema: "pgmigrations",
    skipPattern: "scrap",
    useProceduralScript: false,
    warnOnInvalidPrefix: true,
    parseScriptTags: true,

    hashFunction: function(data) {
        const hash = crypto.createHash('sha1');
        hash.update(data);
        return hash.digest('hex');
    },
    sortByPath: true,
    sortFunction: (a, b, config) => config.sortByPath ? a.script.localeCompare(b.script, "en") : a.name.localeCompare(b.name, "en"),
    versionSortFunction: (a, b, config) => a.version.localeCompare(b.version, "en", {numeric: true}),

    testFunctionsSchemaSimilarTo: "test",
    testFunctionsNameSimilarTo: null,
    testFunctionsCommentSimilarTo: null,
    testAutomaticallyRollbackFunctionTests: false
}
